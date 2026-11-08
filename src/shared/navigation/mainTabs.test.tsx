import { View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { colors } from '../design-system';
import { iconSvgs } from '../design-system/icons/svgs';
import { mainTabs } from './mainTabs';

const historyXml = async (active: boolean) => {
  const history = mainTabs.find(tab => tab.key === 'history');
  if (!history) {
    throw new Error('작업 이력 탭이 없습니다');
  }
  await render(
    <View testID="tab">
      {history.renderIcon({ active, color: '#000000' })}
    </View>,
  );
  const [iconView] = screen.getByTestId('tab', {
    includeHiddenElements: true,
  }).children;
  const [svg] =
    iconView === undefined || typeof iconView === 'string'
      ? []
      : iconView.children;
  if (svg === undefined || typeof svg === 'string') {
    throw new Error('SVG 뷰가 없습니다');
  }
  return { xml: svg.props.xml as string, color: svg.props.color as string };
};

describe('mainTabs — 작업 이력', () => {
  it('선택되면 Figma App Icon · Time History · Active(tab-history-active)를 Primary 로 그린다', async () => {
    const { xml, color } = await historyXml(true);
    expect(xml).toBe(iconSvgs['tab-history-active'].xml);
    expect(xml).toContain('d="M6.78608 10.5365'); // 속도선 채운 시계
    expect(color).toBe(colors.primary);
  });

  it('선택되지 않으면 Figma App Icon · Time History · Default(tab-history)를 그린다', async () => {
    const { xml } = await historyXml(false);
    expect(xml).toBe(iconSvgs['tab-history'].xml);
    expect(xml).toContain('d="M15.5832 19.6389'); // 속도선 테두리 시계
  });
});
