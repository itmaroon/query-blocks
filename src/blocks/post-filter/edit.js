import { __ } from "@wordpress/i18n";
import "./editor.scss";

import {
	useBlockProps,
	useInnerBlocksProps,
	InspectorControls,
} from "@wordpress/block-editor";
import {
	PanelBody,
	ToggleControl,
	SelectControl,
	RangeControl,
	CheckboxControl,
} from "@wordpress/components";

import { useEffect, useState, useCallback } from "@wordpress/element";
import { useSelect, useDispatch } from "@wordpress/data";
import { createBlock } from "@wordpress/blocks";

import { useIsIframeMobile, restTaxonomies } from "itmar-block-packages";

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

const builtin_items = [
	{ value: "search", label: __("Search", "post-blocks") },
	{ value: "date", label: __("Date", "post-blocks") },
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

export default function Edit({ attributes, setAttributes, clientId }) {
	const { selectedBlockId, setFilters } = attributes;

	// dispatch関数を取得
	const { replaceInnerBlocks } = useDispatch("core/block-editor");

	//インナーブロックのひな型を用意
	const TEMPLATE = [];
	const blockProps = useBlockProps();
	const innerBlocksProps = useInnerBlocksProps(blockProps, {
		allowedBlocks: [
			"itmar/design-group",
			"itmar/design-button",
			"itmar/design-checkbox",
		],
		template: TEMPLATE,
		templateLock: false,
	});

	//モバイルの判定
	const isMobile = useIsIframeMobile();

	//エディタ内ブロックの取得
	const { targetBlocks, innerBlocks } = useSelect(
		(select) => ({
			targetBlocks: select("core/block-editor").getBlocks(),
			innerBlocks: select("core/block-editor").getBlocks(clientId),
		}),
		[selectedBlockId],
	);
	//エディタ内ブロックを平坦化
	const allFlattenedBlocks = flattenBlocks(targetBlocks);
	//エディタ内ブロックからitmar/post-pickupを探索
	const pickupPosts = allFlattenedBlocks.filter(
		(block) => block.name === "itmar/pickup-posts",
	);

	//pickupブロックの取得
	const pickup = allFlattenedBlocks.find(
		(block) => block.attributes.pickupId === selectedBlockId,
	);

	//属性変更関数を取得
	const { updateBlockAttributes } = useDispatch("core/block-editor");

	//選択されたpickupで設定されているポストタイプに紐づいているタクソノミーをフィルター項目に追加
	const [filterItems, setFilterItems] = useState(builtin_items);
	const pickupSlug = pickup.attributes.selectedSlug;
	useEffect(() => {
		restTaxonomies(pickupSlug)
			.then((response) => {
				const taxArray = response.map((res) => {
					return {
						value: res.slug,
						label: res.name,
					};
				});
				setFilterItems([...filterItems, ...taxArray]);
			})
			.catch((error) => {
				console.error("投稿の更新に失敗しました", error);
			});
	}, []);

	//フィルターアイテムを取得したらインナーブロックにブロックを詰め込む
	useEffect(() => {
		//Design Groupに入れてレンダリング
		const filterBlock = createBlock(
			"itmar/design-group",
			{}, //既にグループがある場合はその属性を引き継ぐ
			[],
		);
		//インナーブロックを配置
		const newInnerBlocks = [filterBlock];
		replaceInnerBlocks(clientId, newInnerBlocks, false);
	}, [filterItems]);

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
				<PanelBody
					title={__("Filter Item Setting", "post-blocks")}
					initialOpen={true}
					className="form_setteing_ctrl"
				>
					{filterItems.map((filter, index) => {
						return (
							<CheckboxControl
								className="filter_check"
								key={index}
								label={filter.label}
								checked={setFilters.some((setFilter) => {
									return setFilter === filter.value;
								})}
								onChange={(checked) => {
									if (checked) {
										// targetが重複していない場合のみ追加
										if (
											!setFilters.some((item) => _.isEqual(item, filter.value))
										) {
											setAttributes({
												setFilters: [...setFilters, filter.value],
											});
										}
									} else {
										// targetを配列から削除
										setAttributes({
											setFilters: setFilters.filter(
												(item) => !_.isEqual(item, filter.value),
											),
										});
									}
								}}
							/>
						);
					})}
				</PanelBody>
			</InspectorControls>

			<div {...blockProps}>
				<div {...innerBlocksProps}></div>
			</div>
		</>
	);
}
