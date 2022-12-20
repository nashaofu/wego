pub mod api;
pub mod core;
pub mod errors;
pub mod settings;

use actix_files::{Files, NamedFile};
use actix_identity::IdentityMiddleware;
use actix_session::{config::PersistentSession, storage::CookieSessionStore, SessionMiddleware};
use actix_web::{
  cookie::{time, Key},
  dev::{fn_service, ServiceRequest, ServiceResponse},
  middleware::{Logger, NormalizePath},
  web, App, HttpServer, ResponseError,
};
use dotenv::dotenv;
use errors::AppError;
use migration::{Migrator, MigratorTrait};
use sea_orm::Database;
use settings::SETTINGS;
use std::{io, time::Duration};

#[actix_web::main]
async fn main() -> Result<(), io::Error> {
  dotenv().ok();

  env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

  log::info!("Connecting database...");

  let db = Database::connect(SETTINGS.database.url.clone())
    .await
    .expect("Database connect failed");
  Migrator::up(&db, None)
    .await
    .expect("Database migrate failed");

  log::info!("starting HTTP server at http://0.0.0.0:{}", SETTINGS.port);

  HttpServer::new(move || {
    App::new()
      .wrap(NormalizePath::trim())
      .service(
        web::scope("/api")
          .app_data(web::JsonConfig::default().error_handler(|err, _| {
            let status_code = err.status_code();
            let message = err.to_string();
            AppError::new(status_code, status_code.as_u16(), message).into()
          }))
          .app_data(web::Data::new(db.clone()))
          .wrap(Logger::default())
          .wrap(
            IdentityMiddleware::builder()
              // 用户不活动超过一周，则清除登录状态
              .visit_deadline(Some(Duration::from_secs(60 * 60 * 24 * 7)))
              .build(),
          )
          .wrap(
            SessionMiddleware::builder(CookieSessionStore::default(), Key::from(&[0; 64]))
              .cookie_secure(false)
              .session_lifecycle(PersistentSession::default().session_ttl(time::Duration::days(14)))
              .cookie_name(String::from("session"))
              .build(),
          )
          .configure(api::init),
      )
      .service(Files::new("/files", SETTINGS.files_dir.clone()))
      .service(
        Files::new("/", "./www")
          .index_file("index.html")
          .use_etag(true)
          .default_handler(fn_service(|req: ServiceRequest| async {
            let (req, _) = req.into_parts();
            let file = NamedFile::open_async("./www/index.html").await?;
            let res = file.into_response(&req);
            Ok(ServiceResponse::new(req, res))
          })),
      )
  })
  .bind(("0.0.0.0", SETTINGS.port))?
  .run()
  .await
}
