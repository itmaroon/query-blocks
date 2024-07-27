import { __ } from "@wordpress/i18n";
import "./editor.scss";

import {
	useBlockProps,
	useInnerBlocksProps,
	InspectorControls,
} from "@wordpress/block-editor";
import {
	PanelBody,
	PanelRow,
	ToggleControl,
	SelectControl,
	RangeControl,
	RadioControl,
	CheckboxControl,
	__experimentalNumberControl as NumberControl,
} from "@wordpress/components";

import { useEffect, useState, useMemo } from "@wordpress/element";
import { useSelect, useDispatch } from "@wordpress/data";
import { createBlock } from "@wordpress/blocks";

import { useIsIframeMobile, restTaxonomies } from "itmar-block-packages";
import { nanoid } from "nanoid";

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

//期間の設定から選択できる月の情報オブジェクトを配列にする関数
function generateDateArray(dateObj, isMonth) {
	const { startYear, startMonth, endYear, endMonth } = dateObj;
	const result = [];

	for (let year = startYear; year <= endYear; year++) {
		if (isMonth) {
			const monthStart = year === startYear ? startMonth : 1;
			const monthEnd = year === endYear ? endMonth : 12;

			for (let month = monthStart; month <= monthEnd; month++) {
				const unitObj = {
					id: nanoid(5),
					value: `${year}/${month.toString().padStart(2, "0")}`,
					label: `${year}/${month.toString().padStart(2, "0")}`,
					classname: "filter_date",
				};
				result.push(unitObj);
			}
		} else {
			const unitObj = {
				id: nanoid(5),
				value: `${year}`,
				label: `${year}`,
				classname: "filter_date",
			};
			result.push(unitObj);
		}
	}

	return result;
}

export default function Edit({ attributes, setAttributes, clientId }) {
	const {
		selectedBlockId,
		setFilters,
		taxRelate,
		dateOption,
		dateSpan,
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
	//インナーブロック内のDesign Radioボックス
	const radioBlocks = useMemo(() => {
		return allFlattenedBlocks.filter(
			(block) =>
				block.attributes.className &&
				(block.attributes.className?.split(" ").includes("itmar_filter_year") ||
					block.attributes.className
						?.split(" ")
						.includes("itmar_filter_month")),
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
				}
				//フィルタアイテムが日付のとき
				if (filterItem.value === "date") {
					const monthArray = generateDateArray(dateSpan, true);
					const yearArray = generateDateArray(dateSpan, false);

					//インプットボックスの属性
					const setDateAttributes =
						dateOption === "year"
							? {
									...yearAttributes,
									optionValues: yearArray,
									className: yearAttributes.className
										? yearAttributes.className.includes("itmar_filter_year")
											? yearAttributes.className
											: `${yearAttributes.className} itmar_filter_year`
										: "itmar_filter_year",
							  }
							: dateOption === "month"
							? {
									...monthAttributes,
									optionValues: monthArray,
									className: monthAttributes.className
										? monthAttributes.className.includes("itmar_filter_month")
											? monthAttributes.className
											: `${monthAttributes.className} itmar_filter_month`
										: "itmar_filter_month",
							  }
							: {};

					const dateSelectBlock = createBlock(
						"itmar/design-radio",
						setDateAttributes,
						[],
					);
					filterBlocksArray.push(dateSelectBlock);
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
	}, [filterItems, setFilters, dateOption, dateSpan]);

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

			//最初に見つかったitmar_filter_monthブロック
			const yearRadioBolck = allFlattenedBlocks.find(
				(block) =>
					block.name === "itmar/design-radio" &&
					block.attributes.className?.split(" ").includes("itmar_filter_year"),
			);
			//チェックブロックの属性を記録
			if (yearRadioBolck) {
				setAttributes({ yearAttributes: yearRadioBolck.attributes });
			}

			//最初に見つかったitmar_filter_monthブロック
			const monthRadioBolck = allFlattenedBlocks.find(
				(block) =>
					block.name === "itmar/design-radio" &&
					block.attributes.className?.split(" ").includes("itmar_filter_month"),
			);
			//チェックブロックの属性を記録
			if (monthRadioBolck) {
				setAttributes({ monthAttributes: monthRadioBolck.attributes });
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
		//タクソノミーによるフィルタ
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
		//日付によるフィルタ
		if (radioBlocks.length > 0) {
			const savePeriod = radioBlocks[0].attributes.selectedValues
				? radioBlocks[0].attributes.selectedValues
				: "";
			updateBlockAttributes(pickup.clientId, {
				choicePeriod: savePeriod,
				currentPage: 0, //カレントページも０にもどす
			});
		}
	}, [checkboxBlocks, radioBlocks, pickup, filterItems]);

	const today = new Date();

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
						const isChecked = setFilters.some(
							(setFilter) => setFilter === filter.value,
						);
						return (
							<div key={index}>
								<CheckboxControl
									className="filter_check"
									key={index}
									label={filter.label}
									checked={isChecked}
									onChange={(checked) => {
										if (checked) {
											// targetが重複していない場合のみ追加
											if (
												!setFilters.some((item) =>
													_.isEqual(item, filter.value),
												)
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
								{filter.value === "date" && isChecked && (
									<div className="itmar_position_row">
										<RadioControl
											selected={dateOption}
											options={[
												{ label: __("Year", "post-blocks"), value: "year" },
												{ label: __("Month", "post-blocks"), value: "month" },
												{ label: __("Day", "post-blocks"), value: "day" },
											]}
											onChange={(option) =>
												setAttributes({ dateOption: option })
											}
										/>
									</div>
								)}
								{filter.value === "date" &&
									isChecked &&
									dateOption === "month" && (
										<>
											<label>{__("Start of period", "post-blocks")}</label>
											<PanelRow className="itmar_date_span">
												<NumberControl
													label={__("Year", "post-blocks")}
													labelPosition="side"
													max={today.getFullYear()}
													min={2000}
													onChange={(newValue) => {
														setAttributes({
															dateSpan: {
																...dateSpan,
																startYear: Number(newValue),
															},
														});
													}}
													value={dateSpan.startYear}
												/>
												<NumberControl
													label={__("Month", "post-blocks")}
													labelPosition="side"
													max={12}
													min={1}
													onChange={(newValue) => {
														setAttributes({
															dateSpan: {
																...dateSpan,
																startMonth: Number(newValue),
															},
														});
													}}
													value={dateSpan.startMonth}
												/>
											</PanelRow>
											<label>{__("End of period", "post-blocks")}</label>
											<PanelRow className="itmar_date_span">
												<NumberControl
													label={__("Year", "post-blocks")}
													labelPosition="side"
													max={today.getFullYear()}
													min={2000}
													onChange={(newValue) => {
														setAttributes({
															dateSpan: {
																...dateSpan,
																endYear: Number(newValue),
															},
														});
													}}
													value={dateSpan.endYear}
												/>
												<NumberControl
													label={__("Month", "post-blocks")}
													labelPosition="side"
													max={12}
													min={1}
													onChange={(newValue) => {
														setAttributes({
															dateSpan: {
																...dateSpan,
																endMonth: Number(newValue),
															},
														});
													}}
													value={dateSpan.endMonth}
												/>
											</PanelRow>
										</>
									)}
								{filter.value === "date" &&
									isChecked &&
									dateOption === "year" && (
										<>
											<label>{__("Start of period", "post-blocks")}</label>
											<PanelRow className="itmar_date_span">
												<NumberControl
													label={__("Year", "post-blocks")}
													labelPosition="side"
													max={today.getFullYear()}
													min={2000}
													onChange={(newValue) => {
														setAttributes({
															dateSpan: {
																...dateSpan,
																startYear: Number(newValue),
															},
														});
													}}
													value={dateSpan.startYear}
												/>
											</PanelRow>
											<label>{__("End of period", "post-blocks")}</label>
											<PanelRow className="itmar_date_span">
												<NumberControl
													label={__("Year", "post-blocks")}
													labelPosition="side"
													max={today.getFullYear()}
													min={2000}
													onChange={(newValue) => {
														setAttributes({
															dateSpan: {
																...dateSpan,
																endYear: Number(newValue),
															},
														});
													}}
													value={dateSpan.endYear}
												/>
											</PanelRow>
										</>
									)}
							</div>
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
