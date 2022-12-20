import { useCallback, useEffect } from 'react';
import {
  Form, Input, message, Modal,
} from 'antd';
import useRequest from '@/hooks/useRequest';
import { IUser } from '@/recoil/user';
import fetcher from '@/utils/fetcher';
import ImageUploader from '../ImageUploader';
import { IUploadFile, uploadFileToUri, uriToUploadFile } from '@/utils/file';

interface IUserModel extends Pick<IUser, 'name' | 'email'> {
  avatar?: IUploadFile[]
}

interface IUserUpdateData extends Omit<IUserModel, 'avatar'> {
  avatar?: string
}

export interface IUserUpdateProps {
  user?: IUser
  open: boolean
  onOk: (user: IUser) => unknown
  onCancel: () => unknown
}

export default function UserUpdate({
  user, open, onOk, onCancel,
}: IUserUpdateProps) {
  const [form] = Form.useForm<IUserModel>();
  const { loading, fetch } = useRequest((data: IUserUpdateData) => fetcher.put<IUser>('/user/update', data));

  const onFinish = useCallback(async () => {
    const userModel = form.getFieldsValue();
    try {
      const { data } = await fetch({
        name: userModel.name,
        email: userModel.email,
        avatar: uploadFileToUri(userModel.avatar?.[0]),
      });
      onOk(data);
      message.success('账号设置成功');
    } catch (err) {
      message.error('账号设置失败');
      throw err;
    }
  }, [form, fetch, onOk]);

  useEffect(() => {
    if (open) {
      return;
    }

    if (user) {
      form.setFieldsValue({
        name: user.name,
        email: user.email,
        avatar: user.avatar ? [uriToUploadFile(user.avatar)] : [],
      });
    } else {
      form.resetFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal
      title="账号设置"
      open={open}
      onOk={form.submit}
      onCancel={onCancel}
      closable={!loading}
      maskClosable={false}
      keyboard={false}
      okButtonProps={{
        loading,
      }}
      cancelButtonProps={{
        loading,
      }}
    >
      <Form form={form} layout="vertical" autoComplete="off" onFinish={onFinish} scrollToFirstError>
        <Form.Item
          label="用户名"
          name="name"
          required
          validateFirst
          rules={[
            {
              type: 'string',
              required: true,
              message: '请输入用户名',
            },
            {
              type: 'string',
              pattern: /^[a-zA-Z0-9]\w{4,29}$/,
              message: '用户名必须为字母、数字与下划线组成的 5-30 个字符，且只能由字母或数字开头',
            },
          ]}
        >
          <Input showCount maxLength={30} />
        </Form.Item>
        <Form.Item
          label="邮箱"
          name="email"
          required
          validateFirst
          rules={[
            {
              type: 'string',
              required: true,
              message: '请输入邮箱',
            },
            {
              type: 'email',
              message: '请输入合法的邮箱',
            },
            {
              type: 'string',
              min: 5,
              max: 30,
              message: '邮箱长度必须为 5-30 个字符',
            },
          ]}
        >
          <Input showCount maxLength={30} />
        </Form.Item>
        <Form.Item
          label="用户头像"
          name="avatar"
          validateFirst
          rules={[
            {
              validateTrigger: 'onSubmit',
              validator: async (_, value?: IUploadFile[]) => {
                if (!value?.[0]) {
                  return;
                }

                if (value[0].status !== 'done') {
                  throw new Error('文件没有上传完成');
                }

                if (!value[0].response?.uri) {
                  throw new Error('文件没有上传成功');
                }
              },
            },
          ]}
        >
          <ImageUploader maxCount={1} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
