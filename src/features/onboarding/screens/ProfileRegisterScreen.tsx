import { useCallback, useState, type Ref } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, CTA, Icon, Text } from '../../../shared/design-system';
import { KeyboardAvoidingArea } from '../../../shared/keyboard/KeyboardAvoidingArea';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { noOverscroll } from '../../../shared/layout/noOverscroll';
import { FormField } from '../../my/components/FormField';
import { SubScreenHeader } from '../../my/components/SubScreenHeader';
import { formatPhoneNumber, type ProfileInput } from '../../my/model';
import { canRegisterProfile } from '../model';
import {
  STANDALONE_SCREEN_EDGES,
  standaloneScreen,
} from '../../../shared/layout/standaloneScreen';

// Figma 프로필 등록 (3267:11862 빈 입력 / 3267:11212 입력). 마이 › 프로필 수정(#72)과 같은 입력칸을 쓴다.
// 이름 2~20자와 연락처 11자리를 모두 넣어야 '완료' 가 켜진다 (Spec_프로필 입력 화면).
// 가입을 마치지 않고 다시 로그인했으면 서버에 입력해 둔 값으로 채워 연다 (#113)
export function ProfileRegisterScreen({
  initialProfile,
  submitting = false,
  onBack,
  onSubmit,
  titleRef,
}: {
  /** 서버에 입력해 둔 이름·연락처(숫자 11자리). 늦게 오면 아직 고치지 않았을 때만 채운다 */
  initialProfile?: ProfileInput;
  /** 서버에 저장하는 동안 '완료' 를 끈다 */
  submitting?: boolean;
  onBack: () => void;
  onSubmit: (input: ProfileInput) => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const [name, setName] = useState(initialProfile?.name ?? '');
  const [phone, setPhone] = useState(() =>
    formatPhoneNumber(initialProfile?.phoneNumber ?? ''),
  );
  const [edited, setEdited] = useState(false);
  // 켠 직후 뒤에서 확인한 프로필이 그린 뒤에 오면, 아직 고치지 않았을 때만 그 값으로 채운다.
  // 화면을 다시 만들지 않고 렌더 중에 맞춘다 (React 문서 '이전 렌더의 정보 저장')
  const incoming = initialProfile
    ? `${initialProfile.name}\n${initialProfile.phoneNumber}`
    : null;
  const [received, setReceived] = useState(incoming);
  if (incoming !== received) {
    setReceived(incoming);
    if (initialProfile && !edited) {
      setName(initialProfile.name);
      setPhone(formatPhoneNumber(initialProfile.phoneNumber));
    }
  }
  // FormField 가 memo 라 입력 처리 함수를 렌더마다 새로 만들지 않는다
  const changeName = useCallback((text: string) => {
    setEdited(true);
    setName(text);
  }, []);
  const changePhone = useCallback((text: string) => {
    setEdited(true);
    setPhone(formatPhoneNumber(text));
  }, []);
  const canSubmit = canRegisterProfile({ name, phoneNumber: phone });

  const submit = () =>
    onSubmit({ name: name.trim(), phoneNumber: phone.replace(/\D/g, '') });

  return (
    <SafeAreaView
      edges={STANDALONE_SCREEN_EDGES}
      style={standaloneScreen.screen}
    >
      <SubScreenHeader
        title="프로필 등록"
        onBack={onBack}
        titleRef={titleRef}
      />

      <KeyboardAvoidingArea testID="profile-register-body">
        <ScrollView
          {...noOverscroll}
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[readableColumn, styles.content]}
        >
          <View style={styles.avatar}>
            <Icon name="avatar-user" color={colors.support.sideBarIcon} />
          </View>
          <View style={styles.form}>
            <FormField
              label="이름"
              value={name}
              onChangeText={changeName}
              placeholder="김기사"
            />
            <View style={styles.phone}>
              <FormField
                label="연락처"
                value={phone}
                onChangeText={changePhone}
                placeholder="000-0000-0000"
                keyboardType="number-pad"
                // 010-0000-0000 (숫자 11자리 + 하이픈 2개)
                maxLength={13}
              />
              <Text
                variant="Caption/S/Medium"
                color={colors.libraryGray[500]}
                style={styles.hint}
              >
                이름과 연락처는 작업 배정 및 팀 공유에 사용됩니다.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingArea>

      <View style={[readableColumn, standaloneScreen.actions]}>
        <CTA
          label="완료"
          onPress={submit}
          disabled={!canSubmit || submitting}
        />
      </View>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 96;

const styles = StyleSheet.create({
  // 머리 아래 36 에 아바타, 아바타 아래 30 에 입력칸 (Figma 위치 146·272)
  content: {
    gap: 30,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 24,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background[2],
  },
  form: { gap: 24 },
  phone: { gap: 12 },
  hint: { textAlign: 'center' },
});
