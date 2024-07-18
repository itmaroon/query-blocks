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

import { useEffect, useState, useMemo } from "@wordpress/element";
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
	const {
		selectedBlockId,
		setFilters,
		taxRelate,
		dateKind,
		groupBlockAttributes,
		titleAttributes,
		serachBoxAttributes,
		searchButtonAttributes,
		monthAttributes,
		yearAttributes,
		taxRelateAttributes,
		checkBoxAttributes,
	} = attributes;

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
			"itmar/design-text-ctrl",
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
	//全てのブロックを平坦化
	const allFlattenedBlocks = useMemo(() => {
		return flattenBlocks(targetBlocks);
	}, [targetBlocks]);

	//エディタ内ブロックからitmar/post-pickupを探索
	const pickupPosts = useMemo(() => {
		return allFlattenedBlocks.filter(
			(block) => block.name === "itmar/pickup-posts",
		);
	}, [targetBlocks]);

	//インナーブロック内のDesign Checkボックス
	const checkboxBlocks = useMemo(() => {
		return allFlattenedBlocks.filter(
			(block) =>
				block.attributes.className &&
				block.attributes.className.includes("itmar_filter_checkbox"),
		);
	}, [innerBlocks]);

	//pickupブロックの取得
	const pickup = pickupPosts.find(
		(block) => block.attributes.pickupId === selectedBlockId,
	);

	//属性変更関数を取得
	const { updateBlockAttributes } = useDispatch("core/block-editor");

	//選択されたpickupで設定されているポストタイプに紐づいているタクソノミーをフィルター項目に追加
	const [filterItems, setFilterItems] = useState(builtin_items);
	const pickupSlug = pickup?.attributes.selectedSlug;
	useEffect(() => {
		if (pickupSlug) {
			restTaxonomies(pickupSlug)
				.then((response) => {
					const taxArray = response.map((res) => {
						return {
							value: res.slug,
							label: res.name,
							terms: res.terms,
						};
					});
					setFilterItems([...filterItems, ...taxArray]);
				})
				.catch((error) => {
					console.error("投稿の更新に失敗しました", error);
				});
		}
	}, [pickupSlug]);

	//フィルターアイテムを取得したらインナーブロックにブロックを詰め込む
	useEffect(() => {
		const innerBlocksArray = [];

		filterItems.forEach((filterItem) => {
			let filterBlocksArray = [];
			//フィルタ設定の対象になっているか
			if (setFilters.includes(filterItem.value)) {
				//タイトルの属性
				const setTitleAttributes = {
					...titleAttributes,
					className: "itmar_filter_title",
					headingContent: filterItem.label,
				};

				const titleBlock = createBlock(
					"itmar/design-title",
					setTitleAttributes,
				);
				filterBlocksArray.push(titleBlock);
				//フィルタアイテムが検索のとき
				if (filterItem.value === "search") {
					//インプットボックスの属性
					const setInputAttributes = {
						...titleAttributes,
						className: "itmar_filter_title",
						headingContent: filterItem.label,
					};

					const titleBlock = createBlock(
						"itmar/design-title",
						setTitleAttributes,
					);
				}
				//タームの登録があればチェックボックスにする
				if (filterItem.terms) {
					filterItem.terms.forEach((term) => {
						//チェックボックスの属性
						const isTermCheck = pickup.attributes.choiceTerms.some(
							(choiceTerm) =>
								choiceTerm.term && choiceTerm.term.slug === term.slug,
						); //pickupがタームをチェックしているかの判定

						const setCheckboxAttributes = {
							...checkBoxAttributes,
							className: "itmar_filter_checkbox",
							labelContent: term.name,
							inputValue: isTermCheck,
							inputName: term.slug,
						};
						const checkBlock = createBlock(
							"itmar/design-checkbox",
							setCheckboxAttributes,
						);
						filterBlocksArray.push(checkBlock);
					});
				}
				//design-groupを用意
				const filterGroup = createBlock(
					"itmar/design-group",
					{
						className: filterItem.value,
						...groupBlockAttributes, //既にグループがある場合はその属性を引き継ぐ
					},
					filterBlocksArray,
				);
				//全体のインナーブロックに詰める
				innerBlocksArray.push(filterGroup);
			}
		});

		//Design Groupに入れてレンダリング
		const filterBlock = createBlock(
			"itmar/design-group",
			groupBlockAttributes, //既にグループがある場合はその属性を引き継ぐ
			innerBlocksArray,
		);
		//インナーブロックを配置
		const newInnerBlocks = [filterBlock];
		replaceInnerBlocks(clientId, newInnerBlocks, false);
	}, [filterItems, setFilters]);

	//innerBlocksの属性変更
	useEffect(() => {
		if (innerBlocks[0]) {
			//グループブロックの属性を記録
			setAttributes({ groupBlockAttributes: innerBlocks[0].attributes });
			//最初に見つかったitmar_filter_titleブロック
			const titleBolck = allFlattenedBlocks.find(
				(block) =>
					block.name === "itmar/design-title" &&
					block.attributes.className === "itmar_filter_title",
			);
			//タイトルブロックの属性を記録
			if (titleBolck) {
				setAttributes({ titleAttributes: titleBolck.attributes });
			}

			//最初に見つかったitmar_filter_checkboxブロック
			const checkBolck = allFlattenedBlocks.find(
				(block) =>
					block.name === "itmar/design-checkbox" &&
					block.attributes.className === "itmar_filter_checkbox",
			);
			//チェックブロックの属性を記録
			if (checkBolck) {
				setAttributes({ checkBoxAttributes: checkBolck.attributes });
			}
		}
	}, [innerBlocks]);

	//チェックボックスブロックの属性変更（クリック）
	useEffect(() => {
		if (checkboxBlocks.length > 0) {
			//チェックボックスのブロックがチェックされているもののinputNameを集めた配列
			const checkedTerms = checkboxBlocks
				.filter((block) => block.attributes.inputValue === true)
				.map((block) => block.attributes.inputName);
			//filterItemsからtermの情報を収集
			const termsInfo = filterItems
				.filter((item) => "terms" in item)
				.flatMap((item) => item.terms);
			//選択されたtermのスラッグからterm情報を取得して新たなターム情報を生成
			const selTerms = termsInfo
				.filter((term) => term.slug && checkedTerms.includes(term.slug))
				.map((term) => ({
					taxonomy: term.taxonomy,
					term: { id: term.id, slug: term.slug },
				}));

			if (!_.isEqual(selTerms, pickup.attributes.choiceTerms)) {
				updateBlockAttributes(pickup.clientId, {
					choiceTerms: selTerms,
					currentPage: 0, //カレントページも０にもどす
				});
			}
		}
	}, [checkboxBlocks, pickup, filterItems]);

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
