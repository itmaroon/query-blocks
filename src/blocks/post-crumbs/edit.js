import { __ } from "@wordpress/i18n";
import "./editor.scss";

import {
	useBlockProps,
	useInnerBlocksProps,
	InspectorControls,
} from "@wordpress/block-editor";
import { PanelBody, SelectControl } from "@wordpress/components";

import { useEffect, useState } from "@wordpress/element";
import { useSelect, useDispatch } from "@wordpress/data";
import { createBlock } from "@wordpress/blocks";

import {
	useBlockAttributeChanges,
	restFetchData,
	termToDispObj,
} from "itmar-block-packages";

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

//ネストしたブロックを平坦化
const flattenBlocks = (blocks) => {
	return blocks.reduce((acc, block) => {
		acc.push(block);
		if (block.innerBlocks && block.innerBlocks.length > 0) {
			acc.push(...flattenBlocks(block.innerBlocks));
		}
		return acc;
	}, []);
};

// //タームの文字列化
// const termToDispObj = (terms) => {
// 	// taxonomyごとにterm.nameをまとめる
// 	const result = terms.reduce((acc, item) => {
// 		const taxonomy = item.taxonomy;
// 		const termName = item.term.name;

// 		// taxonomyがまだ存在しない場合は初期化
// 		if (!acc[taxonomy]) {
// 			acc[taxonomy] = [];
// 		}

// 		// term.nameを配列に追加
// 		acc[taxonomy].push(termName);

// 		return acc;
// 	}, {});

// 	// 各taxonomyの配列を || でつなげて文字列化
// 	for (const taxonomy in result) {
// 		result[taxonomy] = result[taxonomy].join(" || ");
// 	}

// 	return result;
// };

export default function Edit({ attributes, setAttributes, clientId }) {
	const { selectedBlockId, groupBlockAttributes, crumbBlockAttributes } =
		attributes;
	// ブロック操作関数を取得
	const { replaceInnerBlocks } = useDispatch("core/block-editor");

	//インナーブロックのひな型を用意
	const TEMPLATE = [];
	const blockProps = useBlockProps();
	const innerBlocksProps = useInnerBlocksProps(blockProps, {
		allowedBlocks: ["itmar/design-group", "itmar/design-title"],
		template: TEMPLATE,
		templateLock: false,
	});

	//エディタ内ブロックの取得
	const { targetBlocks, innerBlocks } = useSelect(
		(select) => ({
			targetBlocks: select("core/block-editor").getBlocks(),
			innerBlocks: select("core/block-editor").getBlocks(clientId),
		}),
		[selectedBlockId],
	);

	//ブロックの作成関数
	const blockArrayAdd = (headingContent) => {
		//Design Titleの属性
		const newBlockAttributes = {
			...crumbBlockAttributes,
			className: crumbBlockAttributes.className
				? crumbBlockAttributes.className
				: "itmar_design_crumbs is-style-sub_copy",
			headingContent: headingContent,
		};

		const crumbBlock = createBlock("itmar/design-title", newBlockAttributes);

		return crumbBlock;
	};

	//エディタ内のブロックが変化したときpickupを更新
	const [pickupPosts, setPickupPosts] = useState([]);
	const [pickup, setPickup] = useState(null);
	useEffect(() => {
		//エディタ内ブロックを平坦化
		const allFlattenedBlocks = flattenBlocks(targetBlocks);
		//エディタ内ブロックからitmar/post-pickupを探索
		setPickupPosts(
			allFlattenedBlocks.filter((block) => block.name === "itmar/pickup-posts"),
		);

		//pickupブロックの取得
		setPickup(
			allFlattenedBlocks.find(
				(block) => block.attributes.pickupId === selectedBlockId,
			),
		);
	}, [targetBlocks]);

	//他のブロックに属性の変更を適用
	useBlockAttributeChanges(
		clientId,
		"itmar/design-title",
		"itmar_design_crumbs",
		{ headingContent: "" },
	);

	useEffect(() => {
		if (innerBlocks[0] && innerBlocks[0].innerBlocks.length > 0) {
			//グループブロックの属性を記録
			setAttributes({ groupBlockAttributes: innerBlocks[0].attributes });
			//タイトル属性を記録
			const crumbBlock = innerBlocks[0].innerBlocks.find((block) =>
				block.attributes.className.includes("itmar_design_crumbs"),
			);

			setAttributes({ crumbBlockAttributes: crumbBlock.attributes });
		}
	}, [innerBlocks[0], innerBlocks[0]?.innerBlocks]);

	//フィルター情報を取得したらインナーブロックにdesign-titleを詰め込む
	useEffect(() => {
		if (pickup) {
			const {
				selectedSlug,
				searchWord,
				choicePeriod,
				choiceTerms,
				taxRelateType,
			} = pickup.attributes;
			//投稿タイプの名前取得のためのエンドポイント
			const endPath = `/wp/v2/types/${selectedSlug}`;
			//インナーブロックの配列
			const crumbArray = [];

			if (selectedSlug) {
				restFetchData(endPath).then((data) => {
					//ポストタイプ名
					crumbArray.push(blockArrayAdd(data.name));
					setAttributes({ postTypeName: data.name }); //表示するポスト名を格納
					//検索ワード
					if (searchWord) {
						crumbArray.push(blockArrayAdd(`"${searchWord}"`));
					}
					//期間
					if (choicePeriod) {
						crumbArray.push(blockArrayAdd(choicePeriod));
					}
					//ターム
					if (choiceTerms.length > 0) {
						const dispObj = termToDispObj(choiceTerms, " || ");
						const dispString = Object.values(dispObj).join(
							` ${taxRelateType} `,
						);
						crumbArray.push(blockArrayAdd(dispString));
					}
					//Design Groupに入れてレンダリング
					const crumbBlock = createBlock(
						"itmar/design-group",
						groupBlockAttributes, //既にグループがある場合はその属性を引き継ぐ
						crumbArray,
					);
					//インナーブロックの入れ替え
					replaceInnerBlocks(clientId, [crumbBlock], false);
				});
			}
			//検索ワード
		}
	}, [pickup?.attributes]); //ターゲットのpickup-blockが更新された

	return (
		<>
			<InspectorControls group="settings">
				<PanelBody
					title={__("Linked Post Block", "post-blocks")}
					initialOpen={true}
					className="form_setteing_ctrl"
				>
					<SelectControl
						label={__("Select Pickup Posts Block", "post-blocks")}
						value={selectedBlockId}
						options={[
							{ label: __("Select a block", "post-blocks"), value: "" },
							...pickupPosts.map((block) => ({
								label: block.attributes.pickupId,
								value: block.attributes.pickupId,
							})),
						]}
						onChange={(changeOption) => {
							setAttributes({ selectedBlockId: changeOption });
						}}
					/>
				</PanelBody>
			</InspectorControls>

			<div {...blockProps}>
				<div {...innerBlocksProps}></div>
			</div>
		</>
	);
}
