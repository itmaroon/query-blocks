import { css } from 'styled-components';

//角丸のパラメータを返す
export const radius_prm = (radius) => {
  const ret_radius_prm = (radius && Object.keys(radius).length === 1) ? radius.value : `${(radius && radius.topLeft) || ''} ${(radius && radius.topRight) || ''} ${(radius && radius.bottomRight) || ''} ${(radius && radius.bottomLeft) || ''}`
  return (
    ret_radius_prm
  )
}
//スペースのパラメータを返す
export const space_prm = (space) => {
  const ret_space_prm = `${space.top} ${space.right} ${space.bottom} ${space.left}`;
  return (
    ret_space_prm
  )
}

//スタイルオブジェクト変換関数
export const convertToScss = (styleObject) => {
  let scss = '';
  for (const prop in styleObject) {
    if (styleObject.hasOwnProperty(prop)) {
      const scssProp = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
      scss += `${scssProp}: ${styleObject[prop]};\n`;
    }
  }
  return scss;
}

export const borderProperty = (borderObj) => {
  if (borderObj) {//borderObjがundefinedでない
    let keys = ['top', 'bottom', 'left', 'right'];
    let ret_prop = null;
    let doesKeyExist = keys.some(key => key in borderObj);
    if (doesKeyExist) {//'top', 'bottom', 'left', 'right'が別設定
      let cssString = '';
      for (let side in borderObj) {
        const sideData = borderObj[side];
        const startsWithZero = String(sideData.width || '').match(/^0/);
        if (startsWithZero) {//widthが０ならCSS設定しない
          continue;
        }
        const border_style = sideData.style || 'solid';
        cssString += `border-${side}: ${sideData.width} ${border_style} ${sideData.color};\n`;
      }
      ret_prop = css`${cssString}`;
      return ret_prop;
    } else {//同一のボーダー
      const startsWithZero = String(borderObj.width || '').match(/^0/);

      if (startsWithZero) {//widthが０ならnoneを返す
        return css`border:none`;
      }
      const border_style = borderObj.style || 'solid';
      ret_prop = css`
      border: ${borderObj.width} ${border_style} ${borderObj.color}
      `
      return ret_prop;
    }
  }
  else {
    return null;
  }

}