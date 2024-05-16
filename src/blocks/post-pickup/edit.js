import { useSelect } from "@wordpress/data";
import { StyleComp } from "./StylePickup";
import { ServerStyleSheet } from "styled-components";
import { renderToString } from "react-dom/server";

import { __ } from "@wordpress/i18n";
import {
	dateI18n, // 日付をフォーマットし、サイトのロケールに変換
	format, // 日付のフォーマット
} from "@wordpress/date";
import "./editor.scss";

import {
	useBlockProps,
	InspectorControls,
	__experimentalPanelColorGradientSettings as PanelColorGradientSettings,
	__experimentalBorderRadiusControl as BorderRadiusControl,
} from "@wordpress/block-editor";

import {
	PanelBody,
	PanelRow,
	QueryControls,
	ToggleControl,
	__experimentalBoxControl as BoxControl,
	__experimentalBorderBoxControl as BorderBoxControl,
} from "@wordpress/components";
import { useEffect } from "@wordpress/element";

import {
	useDeepCompareEffect,
	ArchiveSelectControl,
	TermChoiceControl,
	FieldChoiceControl,
} from "itmar-block-packages";
import { useStyleIframe } from "../iframeFooks";

//スペースのリセットバリュー
const padding_resetValues = {
	top: "10px",
	left: "10px",
	right: "10px",
	bottom: "10px",
};

//ボーダーのリセットバリュー
const border_resetValues = {
	top: "0px",
	left: "0px",
	right: "0px",
	bottom: "0px",
};

const units = [
	{ value: "px", label: "px" },
	{ value: "em", label: "em" },
	{ value: "rem", label: "rem" },
];

export default function Edit({ attributes, setAttributes, clientId }) {
	const {
		bgColor,
		margin_value,
		padding_value,
		bgColor_form,
		bgGradient_form,
		radius_value,
		border_value,
		is_shadow,
		is_slide,
		selectedSlug,
		selectedRest,
		choiceTerms,
		choiceFields,
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

	//choiseTerms属性からクエリー用の配列を生成
	const getSelectedTaxonomyTerms = () => {
		const taxonomyTerms = choiceTerms.reduce((acc, { taxonomy, term }) => {
			if (taxonomy === "category") {
				if (acc.hasOwnProperty("categories")) {
					acc["categories"] = `${acc["categories"]},${term.id}`;
				} else {
					acc["categories"] = term.id;
				}
			} else if (taxonomy === "post_tag") {
				if (acc.hasOwnProperty("tags")) {
					acc["tags"] = `${acc["tags"]},${term.id}`;
				} else {
					acc["tags"] = term.id;
				}
			} else {
				if (acc.hasOwnProperty(taxonomy)) {
					acc[taxonomy] = `${acc[taxonomy]},${term.id}`;
				} else {
					acc[taxonomy] = term.id;
				}
			}
			return acc;
		}, {});

		return {
			...taxonomyTerms,
			tax_relation: "OR",
		};
	};

	//coreストアからpostオブジェクトを取得する
	const posts = useSelect(
		(select) => {
			const { getEntityRecords } = select("core");
			const taxonomyTerms = getSelectedTaxonomyTerms();
			console.log(taxonomyTerms);
			return getEntityRecords("postType", selectedSlug, {
				per_page: numberOfItems,
				_embed: true,
				...taxonomyTerms,
			});
		},
		[numberOfItems, selectedSlug, choiceTerms],
	);

	//親ブロックがitmar/slide-mvであればis_slideをオンにする
	const hasSlideBlock = useSelect(
		(select) => {
			const { getBlockParents, getBlockName } = select("core/block-editor");
			const parentIds = getBlockParents(clientId);
			// 直近の親ブロックのみを取得
			const nearestParentId = parentIds.length > 0 ? parentIds[0] : null;
			const nearestParentName = nearestParentId
				? getBlockName(nearestParentId)
				: null;
			return nearestParentName === "itmar/slide-mv";
		},
		[clientId],
	);

	useEffect(() => {
		setAttributes({ is_slide: hasSlideBlock });
	}, [hasSlideBlock]);

	//レンダリングの内容
	function renderContent() {
		return (
			<>
				{posts &&
					posts.map((post) => {
						return (
							<div key={post.id} className={is_slide ? "swiper-slide" : ""}>
								{displayThumbnail &&
									post._embedded &&
									post._embedded["wp:featuredmedia"] &&
									post._embedded["wp:featuredmedia"][0] && (
										<a href={post.link} className="post-thumbnail-link">
											<img
												className="post-thumbnail"
												src={
													post._embedded["wp:featuredmedia"][0].media_details
														.sizes.medium.source_url
												}
												alt={post._embedded["wp:featuredmedia"][0].alt_text}
											/>
										</a>
									)}
								<div className="text-contents">
									<h3 className="post-title">
										<a href={post.link}>
											{post.title.rendered
												? post.title.rendered
												: __("No title", "post-blocks")}
										</a>
									</h3>
									{displayDate && (
										<time
											className="post-date"
											dateTime={format("c", post.date_gmt)}
										>
											{dateI18n("Y.n.j", post.date_gmt)}
										</time>
									)}
								</div>
							</div>
						);
					})}
			</>
		);
	}

	//styled-componentsのスタイルオブジェクトを取り出してブロック属性に保存
	useDeepCompareEffect(() => {
		const sheet = new ServerStyleSheet();
		const htmlString = renderToString(
			sheet.collectStyles(<StyleComp attributes={styleAttributes} />),
		);
		//スタイルオブジェクト
		const styleTags = sheet.getStyleTags();
		//スタイルのクラス名
		const parser = new DOMParser();
		const doc = parser.parseFromString(htmlString, "text/html");
		const divElement = doc.querySelector("div");
		const className = divElement.className;

		setAttributes({ cssStyles: styleTags }); //スタイルオブジェクト
		setAttributes({ styleClass: className }); //クラス名
	}, [styleAttributes]);

	return (
		<>
			<InspectorControls group="settings">
				<PanelBody title={__("Content Settings", "post-blocks")}>
					<ArchiveSelectControl
						selectedSlug={selectedSlug}
						label={__("Select Post Type", "post-blocks")}
						homeUrl={post_blocks.home_url}
						onChange={(postInfo) => {
							if (postInfo) {
								setAttributes({
									selectedSlug: postInfo.slug,
									selectedRest: postInfo.rest_base,
								});
							}
						}}
					/>
					<PanelBody title={__("Choice Taxsonomy", "post-blocks")}>
						<TermChoiceControl
							type="taxonomy"
							selectedSlug={selectedSlug}
							choiceItems={choiceTerms}
							onChange={(newChoiceTerms) => {
								setAttributes({ choiceTerms: newChoiceTerms });
							}}
						/>
					</PanelBody>

					<PanelBody title={__("Choice Field", "post-blocks")}>
						<FieldChoiceControl
							type="field"
							selectedSlug={selectedRest}
							choiceItems={choiceFields}
							onChange={(newChoiceFields) =>
								setAttributes({ choiceFields: newChoiceFields })
							}
						/>
					</PanelBody>

					<PanelRow className="itmar_post_blocks_pannel">
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
							label={__("Show Featured Image", "post-blocks")}
							checked={displayThumbnail}
							onChange={() =>
								setAttributes({ displayThumbnail: !displayThumbnail })
							}
						/>
					</PanelRow>
					<PanelRow>
						<ToggleControl
							label={__("Show Date", "post-blocks")}
							checked={displayDate}
							onChange={() => setAttributes({ displayDate: !displayDate })}
						/>
					</PanelRow>
				</PanelBody>
			</InspectorControls>
			<InspectorControls group="styles">
				<PanelBody
					title={__("Global settings", "post-blocks")}
					initialOpen={false}
					className="check_design_ctrl"
				>
					<PanelColorGradientSettings
						title={__("Background Color Setting", "post-blocks")}
						settings={[
							{
								colorValue: bgColor,
								label: __("Choose Block Background color", "post-blocks"),
								onColorChange: (newValue) =>
									setAttributes({ bgColor: newValue }),
							},
							{
								colorValue: bgColor_form,
								gradientValue: bgGradient_form,

								label: __("Choose Form Background color", "post-blocks"),
								onColorChange: (newValue) => {
									setAttributes({
										bgGradient_form: newValue === undefined ? "" : newValue,
									});
								},
								onGradientChange: (newValue) =>
									setAttributes({ bgGradient_form: newValue }),
							},
						]}
					/>
					<BoxControl
						label={__("Margin settings", "post-blocks")}
						values={margin_value}
						onChange={(value) => setAttributes({ margin_value: value })}
						units={units} // 許可する単位
						allowReset={true} // リセットの可否
						resetValues={padding_resetValues} // リセット時の値
					/>

					<BoxControl
						label={__("Padding settings", "post-blocks")}
						values={padding_value}
						onChange={(value) => setAttributes({ padding_value: value })}
						units={units} // 許可する単位
						allowReset={true} // リセットの可否
						resetValues={padding_resetValues} // リセット時の値
					/>
					<PanelBody
						title={__("Border Settings", "post-blocks")}
						initialOpen={false}
						className="border_design_ctrl"
					>
						<BorderBoxControl
							colors={[
								{ color: "#72aee6" },
								{ color: "#000" },
								{ color: "#fff" },
							]}
							onChange={(newValue) => setAttributes({ border_value: newValue })}
							value={border_value}
							allowReset={true} // リセットの可否
							resetValues={border_resetValues} // リセット時の値
						/>
						<BorderRadiusControl
							values={radius_value}
							onChange={(newBrVal) =>
								setAttributes({
									radius_value:
										typeof newBrVal === "string"
											? { value: newBrVal }
											: newBrVal,
								})
							}
						/>
					</PanelBody>
					<ToggleControl
						label={__("Is Shadow", "post-blocks")}
						checked={is_shadow}
						onChange={(newVal) => {
							setAttributes({ is_shadow: newVal });
						}}
					/>
				</PanelBody>
			</InspectorControls>
			{renderContent()}
		</>
	);
}
