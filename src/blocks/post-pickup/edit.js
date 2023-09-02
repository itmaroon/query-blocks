import { useSelect } from '@wordpress/data';
import { StyleComp } from './StylePickup';
import { ServerStyleSheet } from 'styled-components';
import { renderToString } from 'react-dom/server';


import { __ } from '@wordpress/i18n';
import {
	dateI18n,    // 日付をフォーマットし、サイトのロケールに変換
	format,      // 日付のフォーマット
	__experimentalGetSettings   // WordPress の一般設定の日付フォーマットにする
} from '@wordpress/date';
import './editor.scss';

import {
	useBlockProps,
	InspectorControls,
	__experimentalPanelColorGradientSettings as PanelColorGradientSettings,
	__experimentalBorderRadiusControl as BorderRadiusControl
} from '@wordpress/block-editor';

import {
	Disabled,
	PanelBody,
	PanelRow,
	QueryControls,
	ToggleControl,
	__experimentalBoxControl as BoxControl,
	__experimentalBorderBoxControl as BorderBoxControl
} from '@wordpress/components';

import { useDeepCompareEffect } from "../CustomFooks"
import { useStyleIframe } from '../iframeFooks';

//スペースのリセットバリュー
const padding_resetValues = {
	top: '10px',
	left: '10px',
	right: '10px',
	bottom: '10px',
}

//ボーダーのリセットバリュー
const border_resetValues = {
	top: '0px',
	left: '0px',
	right: '0px',
	bottom: '0px',
}

const units = [
	{ value: 'px', label: 'px' },
	{ value: 'em', label: 'em' },
	{ value: 'rem', label: 'rem' },
];


export default function Edit({ attributes, setAttributes }) {
	const {
		bgColor,
		margin_value,
		padding_value,
		bgColor_form,
		bgGradient_form,
		radius_value,
		border_value,
		is_shadow,

	} = attributes;

	const {
		cssStyles,
		styleClass,
		numberOfItems,
		displayDate,
		displayThumbnail,
		...styleAttributes
	} = attributes;

	//背景色をブロックのルートにインラインでセット
	const blockProps = useBlockProps({ style: { backgroundColor: bgColor } });

	//サイトエディタの場合はiframeにスタイルをわたす。
	useStyleIframe(StyleComp, attributes);

	//coreストアからpostオブジェクトを取得する
	const posts = useSelect(
		(select) => {
			return select('core').getEntityRecords('postType', 'post', {
				'per_page': numberOfItems,
				'_embed': true
			});
		},
		[numberOfItems]
	);

	//レンダリングの内容
	function renderContent() {
		return (
			<ul className='post_items'>
				{posts && posts.map((post) => {
					return (
						<li key={post.id}>
							{
								displayThumbnail &&
								post._embedded &&
								post._embedded['wp:featuredmedia'] &&
								post._embedded['wp:featuredmedia'][0] &&
								<a href={post.link} className='post-thumbnail-link'>
									<img
										className='post-thumbnail'
										src={post._embedded['wp:featuredmedia'][0].media_details.sizes.medium.source_url}
										alt={post._embedded['wp:featuredmedia'][0].alt_text}
									/>
								</a>
							}
							<div className='text-contents'>
								<h3 className='post-title'>
									<a href={post.link}>
										{post.title.rendered ? (
											post.title.rendered
										) : (
											__('No title', 'itmar_post_blocks')
										)}
									</a>
								</h3>
								{
									displayDate && (
										<time
											className='post-date'
											dateTime={format('c', post.date_gmt)}
										>
											{dateI18n(
												__experimentalGetSettings().formats.date,
												post.date_gmt
											)}
										</time>
									)
								}
							</div>
						</li>
					)
				})}
			</ul>
		)
	}

	//styled-componentsのスタイルオブジェクトを取り出してブロック属性に保存
	useDeepCompareEffect(() => {
		const sheet = new ServerStyleSheet();
		const htmlString = renderToString(sheet.collectStyles(<StyleComp attributes={styleAttributes} />));
		console.log(htmlString)
		//スタイルオブジェクト
		const styleTags = sheet.getStyleTags();
		//スタイルのクラス名
		const parser = new DOMParser();
		const doc = parser.parseFromString(htmlString, 'text/html');
		const divElement = doc.querySelector('div');
		const className = divElement.className;

		setAttributes({ cssStyles: styleTags });//スタイルオブジェクト
		setAttributes({ styleClass: className });//クラス名
	}, [styleAttributes]);

	return (
		<>
			<InspectorControls group="settings">
				<PanelBody title={__('Content Settings', 'itmar_post_blocks')}>
					<PanelRow className='itmar_post_blocks_pannel'>
						<QueryControls
							numberOfItems={numberOfItems}
							onNumberOfItemsChange={(value) =>
								setAttributes({ numberOfItems: value })
							}
							minItems={1}
							maxItems={10}
						/>
					</PanelRow>
					<PanelRow>
						<ToggleControl
							label={__('Show Featured Image', 'itmar_post_blocks')}
							checked={displayThumbnail}
							onChange={() =>
								setAttributes({ displayThumbnail: !displayThumbnail })
							}
						/>
					</PanelRow>
					<PanelRow>
						<ToggleControl
							label={__('Show Date', 'itmar_post_blocks')}
							checked={displayDate}
							onChange={() =>
								setAttributes({ displayDate: !displayDate })
							}
						/>
					</PanelRow>
				</PanelBody>
			</InspectorControls>
			<InspectorControls group="styles">

				<PanelBody title={__("Global settings", 'itmar_post_blocks')} initialOpen={false} className="check_design_ctrl">
					<PanelColorGradientSettings
						title={__("Background Color Setting", 'itmar_post_blocks')}
						settings={[
							{
								colorValue: bgColor,
								label: __("Choose Block Background color", 'itmar_post_blocks'),
								onColorChange: (newValue) => setAttributes({ bgColor: newValue })
							},
							{
								colorValue: bgColor_form,
								gradientValue: bgGradient_form,

								label: __("Choose Form Background color", 'itmar_post_blocks'),
								onColorChange: (newValue) => {
									setAttributes({ bgGradient_form: newValue === undefined ? '' : newValue });
								},
								onGradientChange: (newValue) => setAttributes({ bgGradient_form: newValue }),
							},
						]}
					/>
					<BoxControl
						label={__("Margin settings", 'itmar_post_blocks')}
						values={margin_value}
						onChange={value => setAttributes({ margin_value: value })}
						units={units}	// 許可する単位
						allowReset={true}	// リセットの可否
						resetValues={padding_resetValues}	// リセット時の値

					/>

					<BoxControl
						label={__("Padding settings", 'itmar_post_blocks')}
						values={padding_value}
						onChange={value => setAttributes({ padding_value: value })}
						units={units}	// 許可する単位
						allowReset={true}	// リセットの可否
						resetValues={padding_resetValues}	// リセット時の値

					/>
					<PanelBody title={__("Border Settings", 'itmar_post_blocks')} initialOpen={false} className="border_design_ctrl">
						<BorderBoxControl
							colors={[{ color: '#72aee6' }, { color: '#000' }, { color: '#fff' }]}
							onChange={(newValue) => setAttributes({ border_value: newValue })}
							value={border_value}
							allowReset={true}	// リセットの可否
							resetValues={border_resetValues}	// リセット時の値
						/>
						<BorderRadiusControl
							values={radius_value}
							onChange={(newBrVal) =>
								setAttributes({ radius_value: typeof newBrVal === 'string' ? { "value": newBrVal } : newBrVal })}
						/>
					</PanelBody>
					<ToggleControl
						label={__('Is Shadow', 'itmar_post_blocks')}
						checked={is_shadow}
						onChange={(newVal) => {
							setAttributes({ is_shadow: newVal })
						}}
					/>
				</PanelBody>
			</InspectorControls>

			<div {...blockProps}>
				<Disabled>
					<StyleComp attributes={styleAttributes}>
						{renderContent()}
					</StyleComp>
				</Disabled>

			</div>
		</>
	);
}
