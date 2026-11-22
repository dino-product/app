import { toLocation } from './useAgreeJump';

// SectionList 는 약관마다 [머리, 칸…, 꼬리] 로 펼친다. 목록이 알려 주는 펼친 순서(재 둔 끝 칸)를
// scrollToLocation 의 자리(약관 번호, 그 안 칸 번호. 0 은 머리)로 되돌린다 (#218)
describe('toLocation', () => {
  // 약관 0: 칸 3개 → 펼친 순서 0(머리) 1 2 3 4(꼬리), 약관 1: 칸 2개 → 5(머리) 6 7 8(꼬리)
  const sections = [
    { key: 'a', index: 0, data: [1, 2, 3] },
    { key: 'b', index: 1, data: [1, 2] },
  ];

  it.each([
    [0, { sectionIndex: 0, itemIndex: 0 }],
    [3, { sectionIndex: 0, itemIndex: 3 }],
    [4, { sectionIndex: 0, itemIndex: 4 }],
    [5, { sectionIndex: 1, itemIndex: 0 }],
    [7, { sectionIndex: 1, itemIndex: 2 }],
    [8, { sectionIndex: 1, itemIndex: 3 }],
  ])('펼친 순서 %d → %o', (flatIndex, location) => {
    expect(toLocation(sections, flatIndex)).toEqual(location);
  });

  it('범위를 넘으면 마지막 약관의 꼬리로 둔다', () => {
    expect(toLocation(sections, 99)).toEqual({ sectionIndex: 1, itemIndex: 3 });
  });
});
