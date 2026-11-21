import { render, screen } from '@testing-library/react-native';
import { FlatList, Image, Text, View } from 'react-native';
import { Icon } from '../design-system';
import { expectMessageOnly } from './emptyState';

// ListEmptyComponent 에 그린 빈 상태를 리스트 안에서 찾는다 (#196 리뷰)
const renderEmpty = (empty: React.ReactElement) =>
  render(
    <FlatList
      data={[]}
      renderItem={() => null}
      ListHeaderComponent={<Text>머리</Text>}
      ListEmptyComponent={empty}
    />,
  );

describe('expectMessageOnly', () => {
  it('안내 글 한 줄뿐이면 통과한다', async () => {
    await renderEmpty(<Text>이 날은 일정이 없습니다</Text>);

    expectMessageOnly(screen.getByText('이 날은 일정이 없습니다'));
  });

  it('글이 여러 조각(children 배열)이어도 이어 붙인 글 그대로 견준다', async () => {
    const count = 0;
    await renderEmpty(<Text>완료한 작업 {count}건</Text>);

    expectMessageOnly(screen.getByText('완료한 작업 0건'));
  });

  it('설명 글이 더 있으면 실패한다', async () => {
    await renderEmpty(
      <View>
        <Text>이 날은 일정이 없습니다</Text>
        <Text>새 작업이 배정되면 여기에 표시돼요</Text>
      </View>,
    );

    expect(() =>
      expectMessageOnly(screen.getByText('이 날은 일정이 없습니다')),
    ).toThrow();
  });

  it.each([
    ['Icon(SvgXml)', <Icon key="icon" name="phone" />],
    ['Image', <Image key="image" source={{ uri: 'file:///empty.png' }} />],
  ])('아이콘(%s)이 있으면 실패한다', async (_label, icon) => {
    await renderEmpty(
      <View>
        {icon}
        <Text>이 날은 일정이 없습니다</Text>
      </View>,
    );

    expect(() =>
      expectMessageOnly(screen.getByText('이 날은 일정이 없습니다')),
    ).toThrow();
  });
});
