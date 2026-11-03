import { useCallback, useState, type Ref } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, CTA, Icon } from '../../../shared/design-system';
import { KeyboardAvoidingArea } from '../../../shared/keyboard/KeyboardAvoidingArea';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { FormField } from '../components/FormField';
import { SubScreenHeader } from '../components/SubScreenHeader';
import { canSaveProfile, formatPhoneNumber, type ProfileInput } from '../model';

// Figma 마이페이지-프로필 수정 (3255:19508 빈 입력 / 3255:19478 입력 중).
// 지금 이름·연락처를 채워 열고, 바뀐 값이 규칙에 맞을 때만 '저장하기' 가 켜진다
export function ProfileEditScreen({
  profile,
  onBack,
  onSave,
  titleRef,
}: {
  profile: ProfileInput;
  onBack: () => void;
  onSave: (input: ProfileInput) => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(() =>
    formatPhoneNumber(profile.phoneNumber),
  );
  // FormField 가 memo 라 입력 처리 함수를 렌더마다 새로 만들지 않는다
  const changePhone = useCallback(
    (text: string) => setPhone(formatPhoneNumber(text)),
    [],
  );
  const input = { name, phoneNumber: phone };
  const canSave = canSaveProfile(profile, input);

  const save = () =>
    onSave({ name: name.trim(), phoneNumber: phone.replace(/\D/g, '') });

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader
        title="프로필 수정"
        onBack={onBack}
        titleRef={titleRef}
      />

      <KeyboardAvoidingArea testID="profile-edit-body">
        <ScrollView
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[readableColumn, styles.content]}
        >
          <View style={styles.avatar}>
            <Icon name="user" size={44} color={colors.support.sideBarIcon} />
          </View>
          <FormField
            label="이름"
            value={name}
            onChangeText={setName}
            placeholder="김기사"
          />
          <FormField
            label="연락처"
            value={phone}
            onChangeText={changePhone}
            placeholder="000-0000-0000"
            keyboardType="number-pad"
            // 010-0000-0000 (숫자 11자리 + 하이픈 2개)
            maxLength={13}
          />
        </ScrollView>
      </KeyboardAvoidingArea>

      <View style={[readableColumn, styles.actions]}>
        <CTA label="저장하기" onPress={save} disabled={!canSave} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  content: {
    gap: 24,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: colors.background[2],
  },
  actions: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
});
