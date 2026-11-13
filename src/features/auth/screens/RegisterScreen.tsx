import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation } from '@react-navigation/native';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';

import { useTranslation } from '@/shared/i18n';
import { useIsOnline } from '@/shared/lifecycle/network';
import { FormTextField } from '@/shared/ui/form/FormTextField';
import { OfflineNotice } from '@/shared/ui/offline/Offline';
import { Button } from '@/shared/ui/primitives/Button';
import { type TextInputRef } from '@/shared/ui/primitives/Input';
import { Screen } from '@/shared/ui/primitives/Screen';
import { Stack } from '@/shared/ui/primitives/Stack';
import { errorMessage } from '@/shared/ui/primitives/States';
import { Text } from '@/shared/ui/primitives/Text';

import { SocialSignIn } from '../components/SocialSignIn';
import { hasErrorCode, useRegister } from '../hooks/useAuthMutations';
import { type RegisterInput, RegisterInputSchema } from '../schema';

export function RegisterScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const emailRef = useRef<TextInputRef>(null);
  const passwordRef = useRef<TextInputRef>(null);
  const register = useRegister();
  const online = useIsOnline();
  const { control, handleSubmit } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterInputSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const submit = () => {
    if (!online) return; // offline pattern C
    handleSubmit(values => register.mutate(values))();
  };
  const failure = register.error
    ? hasErrorCode(register.error, 'email_taken')
      ? t('auth.register.emailTaken')
      : errorMessage(register.error, t)
    : null;
  const translate = (key: string) => t(key as never);

  return (
    <Screen scroll testID="register-screen">
      <Stack gap="xs">
        <Text variant="display">{t('auth.register.title')}</Text>
        <Text tone="muted">{t('auth.register.subtitle')}</Text>
      </Stack>
      <Stack gap="lg">
        <FormTextField
          control={control}
          name="name"
          label={t('auth.fields.name')}
          translateError={translate}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <FormTextField
          ref={emailRef}
          control={control}
          name="email"
          label={t('auth.fields.email')}
          translateError={translate}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <FormTextField
          ref={passwordRef}
          control={control}
          name="password"
          label={t('auth.fields.password')}
          translateError={translate}
          hint={t('auth.validation.passwordShort')}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {failure ? (
          <Text tone="danger" aria-live="polite">
            {failure}
          </Text>
        ) : null}
        <OfflineNotice message={t('offline.registerBlocked')} />
        <Button
          title={t('auth.register.submit')}
          onPress={submit}
          loading={register.isPending}
          disabled={!online}
          fullWidth
        />
      </Stack>

      <SocialSignIn />
      <Stack gap="sm" align="center">
        <Text tone="muted">{t('auth.register.haveAccount')}</Text>
        <Button
          title={t('auth.register.signIn')}
          variant="ghost"
          onPress={() => navigation.goBack()}
        />
      </Stack>
    </Screen>
  );
}
