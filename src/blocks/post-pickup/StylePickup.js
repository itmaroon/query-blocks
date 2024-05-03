import styled, { css } from 'styled-components';
import { radius_prm, space_prm, convertToScss, borderProperty } from 'itmar-block-packages';

// カスタムコンポーネントの定義
const StyledDivComponent = ({ className, children }) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};

const StyledDiv = styled(StyledDivComponent)`

  ${({ attributes }) => {

    const {
      margin_value,
      padding_value,
      bgColor_form,
      bgGradient_form,
      radius_value,
      border_value,
      shadow_result,
      is_shadow,
      className,
    } = attributes;

    //単色かグラデーションかの選択
    const bgColor = bgColor_form || bgGradient_form;
    //斜体の設定
    //const fontStyle_label = font_style_label?.isItalic ? "italic" : "normal";
    //角丸の設定
    const block_radius_prm = radius_prm(radius_value);
    //スペースの設定
    const margin_prm = space_prm(margin_value);
    const padding_prm = space_prm(padding_value);
    //ボックスシャドーの設定
    //const box_shadow_style = is_shadow && shadow_result ? convertToScss(shadow_result) : ''

    // 共通のスタイルをここで定義します
    const commonStyle = css`
      .post_items{
        margin: ${margin_prm};
        padding: ${padding_prm};
        background: ${bgColor};
        border-radius: ${block_radius_prm};
        ${borderProperty(border_value)};
        display: flex;
      }
    `;


    // const cssMap = {
    //   'is-style-progress': barStyle,
    //   'is-style-card': cardStyle,
    // };
    // const defaultStyle = barStyle;
    // const optionStyle = cssMap[className] || defaultStyle;
    // 共通のスタイルを組み合わせて返します
    return css`
      ${commonStyle}
    `;
  }}
`;

export const StyleComp = ({ attributes, children }) => {
  return (
    <StyledDiv attributes={attributes} >
      {children}
    </StyledDiv >
  );
}