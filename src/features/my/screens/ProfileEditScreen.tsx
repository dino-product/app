import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useState, type Ref } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiErrorCode, isApiError, useApiClient } from '../../../shared/api';
import { colors, CTA, Icon } from '../../../shared/design-system';
import { KeyboardAvoidingArea } from '../../../shared/keyboard/KeyboardAvoidingArea';
import { LoadStateView } from '../../../shared/layout/LoadStateView';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { noOverscroll } from '../../../shared/layout/noOverscroll';
import {
  currentAccountId,
  ProfileErrorCode,
  profileQuery,
  saveProfile,
  type AccountProfile,
} from '../../onboarding/profileApi';
import { FormField } from '../components/FormField';
import { SubScreenHeader } from '../components/SubScreenHeader';
import {
  canSaveProfile,
  formatPhoneNumber,
  PROFILE_RULE_MESSAGE,
  toMyProfile,
  type ProfileInput,
} from '../model';
import { queryState } from '../queryState';

// Figma 마이페이지-프로필 수정 (3255:19508 빈 입력 / 3255:19478 입력 중).
// 서버의 지금 이름·연락처를 채워 열고, 바뀐 값이 규칙에 맞을 때만 '저장하기' 가 켜진다.
// 저장은 PUT /profiles/{accountId} (#115). 성공하면 서버가 돌려준 프로필로 onSaved, 실패하면 머물러 입력을 지키고 알린다.
// 받는 중·실패 자리와 저장 실패 알림창은 Figma 에 없어 기본안이다 (Figma 미확인)
export function ProfileEditScreen({
  onBack,
  onSaved,
  titleRef,
}: {
  onBack: () => void;
  /** 저장에 성공했다. 서버가 돌려준 프로필 */
  onSaved: (profile: AccountProfile) => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const api = useApiClient();
  // 마이페이지가 받아 둔 프로필을 쓴다. 보던 화면을 복원해 바로 열렸으면 여기서 받는다
  const profile = queryState(
    useQuery({ ...profileQuery(api), select: toMyProfile }),
    '프로필을 불러오지 못했어요.',
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader
        title="프로필 수정"
        onBack={onBack}
        titleRef={titleRef}
      />
      {profile.status === 'ready' ? (
        <ProfileForm saved={profile.data} onSaved={onSaved} />
      ) : (
        <LoadStateView state={profile} />
      )}
    </SafeAreaView>
  );
}

// 서버는 어느 칸이 틀렸는지 알려 주지 않는다 (앱도 같은 규칙으로 미리 막는다)
const saveFailure = (error: unknown): [string, string] => {
  if (isApiError(error, ProfileErrorCode.invalidInput)) {
    return ['입력한 정보를 확인해 주세요', PROFILE_RULE_MESSAGE];
  }
  if (isApiError(error, ApiErrorCode.conflict)) {
    return [
      '프로필을 저장하지 못했어요',
      '다른 곳에서 저장하는 중이었어요. 다시 시도해 주세요.',
    ];
  }
  return ['프로필을 저장하지 못했어요', '잠시 후 다시 시도해 주세요.'];
};

// 입력칸은 처음 연 때의 서버 값으로 채운다. 그 뒤 캐시가 바뀌어도(다시 받기) 고치던 값을 덮지 않는다
function ProfileForm({
  saved,
  onSaved,
}: {
  saved: ProfileInput;
  onSaved: (profile: AccountProfile) => void;
}) {
  const api = useApiClient();
  const [name, setName] = useState(saved.name);
  const [phone, setPhone] = useState(() =>
    formatPhoneNumber(saved.phoneNumber),
  );
  // FormField 가 memo 라 입력 처리 함수를 렌더마다 새로 만들지 않는다
  const changePhone = useCallback(
    (text: string) => setPhone(formatPhoneNumber(text)),
    [],
  );
  // 본인 accountId 는 기기 세션에서 읽는다
  const save = useMutation({
    mutationFn: async (input: ProfileInput) =>
      saveProfile(api, await currentAccountId(api), input),
  });
  const canSave =
    canSaveProfile(saved, { name, phoneNumber: phone }) && !save.isPending;

  const submit = () => {
    if (save.isPending) {
      return;
    }
    save.mutate(
      { name: name.trim(), phoneNumber: phone.replace(/\D/g, '') },
      {
        onSuccess: profile => onSaved(profile),
        onError: error => Alert.alert(...saveFailure(error)),
      },
    );
  };

  return (
    <>
      <KeyboardAvoidingArea testID="profile-edit-body">
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

      {/* 저장하는 동안에는 꺼 두어 다시 눌리지 않는다 */}
      <View style={[readableColumn, styles.actions]}>
        <CTA label="저장하기" onPress={submit} disabled={!canSave} />
      </View>
    </>
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
