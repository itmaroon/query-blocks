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

import {
	useIsIframeMobile,
	restTaxonomies,
	useBlockAttributeChanges,
} from "itmar-block-packages";
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
		searchFields,
		taxRelate,
		dateOption,
		dateSpan,
		groupBlockAttributes,
		titleAttributes,
		groupSearchAttributes,
		searchBoxAttributes,
		searchButtonAttributes,
		monthAttributes,
		yearAttributes,
		dayAttributes,
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

	//インナーブロックのブロックを平坦化
	const innerFlattenedBlocks = useMemo(() => {
		return flattenBlocks(innerBlocks);
	}, [innerBlocks]);

	//エディタ内ブロックからitmar/post-pickupを探索
	const pickupPosts = useMemo(() => {
		return allFlattenedBlocks.filter(
			(block) => block.name === "itmar/pickup-posts",
		);
	}, [targetBlocks]);

	//インナーブロック内の検索用インプットボックス
	const searchBox = useMemo(() => {
		return innerFlattenedBlocks.find(
			(block) =>
				block.attributes.className &&
				block.attributes.className
					?.split(" ")
					.includes("itmar_filter_searchbox"),
		);
	}, [innerBlocks]);

	//インナーブロック内の検索用ボタン
	const searchButton = useMemo(() => {
		return innerFlattenedBlocks.find(
			(block) =>
				block.attributes.className &&
				block.attributes.className
					?.split(" ")
					.includes("itmar_filter_searchbutton"),
		);
	}, [innerBlocks]);

	//インナーブロック内のDesign Checkボックス
	const checkboxBlocks = useMemo(() => {
		return innerFlattenedBlocks.filter(
			(block) =>
				block.attributes.className &&
				block.attributes.className.includes("itmar_filter_checkbox"),
		);
	}, [innerBlocks]);
	//インナーブロック内のDesign Radioボックス
	const periodBlocks = useMemo(() => {
		return innerFlattenedBlocks.filter(
			(block) =>
				block.attributes.className &&
				(block.attributes.className?.split(" ").includes("itmar_filter_year") ||
					block.attributes.className
						?.split(" ")
						.includes("itmar_filter_month") ||
					block.attributes.className?.split(" ").includes("itmar_filter_day")),
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
	const [isfilterReady, setIsfilterReady] = useState(false); //タクソノミーの情報を取得できたかのフラグ
	useEffect(() => {
		if (pickupSlug) {
			restTaxonomies(pickupSlug)
				.then((response) => {
					setIsfilterReady(true); //準備完了フラグをオン
					const taxArray = response.map((res) => {
						return {
							value: res.slug,
							label: res.name,
							terms: res.terms,
						};
					});
					//一旦タームのついたフィルタ要素は削除
					const removeTax = filterItems.filter(
						(item) => !item.hasOwnProperty("terms"),
					);
					setFilterItems([...removeTax, ...taxArray]);
				})
				.catch((error) => {
					console.error("投稿の更新に失敗しました", error);
				});
		} else {
			setFilterItems(builtin_items);
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
					//クラス名は既存のものに上書き、タイトルは独自のもので上書き
					className: "itmar_filter_title",
					...titleAttributes,
					headingContent: filterItem.label,
				};

				const titleBlock = createBlock(
					"itmar/design-title",
					setTitleAttributes,
				);
				filterBlocksArray.push(titleBlock);

				//フィルタアイテムが検索のとき
				if (filterItem.value === "search") {
					const searchBlocksArray = [];
					//インプットボックスの属性
					const defaultWord = pickup?.attributes.searchWord
						? { inputValue: pickup?.attributes.searchWord }
						: null;
					const searchInput = createBlock("itmar/design-text-ctrl", {
						className: "itmar_filter_searchbox",
						...searchBoxAttributes, //既存属性にクラス名があるときは上書きされる
						...defaultWord, //既入力キーワードが残っている場合
					});
					const searchButton = createBlock("itmar/design-button", {
						className: "itmar_filter_searchbutton",
						...searchButtonAttributes,
					});
					searchBlocksArray.push(searchInput);
					searchBlocksArray.push(searchButton);
					//design-groupを用意
					const searchGroup = createBlock(
						"itmar/design-group",
						{
							className: filterItem.value,
							...groupSearchAttributes, //デフォルトのクループ設定
						},
						searchBlocksArray,
					);

					filterBlocksArray.push(searchGroup);
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
									isSetSelect: false,
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
									isSetSelect: false,
									className: monthAttributes.className
										? monthAttributes.className.includes("itmar_filter_month")
											? monthAttributes.className
											: `${monthAttributes.className} itmar_filter_month`
										: "itmar_filter_month",
							  }
							: dateOption === "day"
							? {
									...dayAttributes,
									dateSpan: dateSpan,
									className: dayAttributes.className
										? dayAttributes.className.includes("itmar_filter_day")
											? dayAttributes.className
											: `${dayAttributes.className} itmar_filter_day`
										: "itmar_filter_day",
							  }
							: {};
					//ブロックの種別を設定
					const blockKind =
						dateOption === "year" || dateOption === "month"
							? "itmar/design-radio"
							: "itmar/design-calender";
					//ブロックの生成
					const dateSelectBlock = createBlock(blockKind, setDateAttributes, []);
					filterBlocksArray.push(dateSelectBlock);
				}
				//タームの登録があればチェックボックスにする
				if (filterItem.terms) {
					filterItem.terms.forEach((term) => {
						//チェックボックスの属性
						const isTermCheck = pickup?.attributes.choiceTerms.some(
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
	//特定のブロックで属性が変更されたときの変更後の属性を取得する（コンテントは除く）
	const changeTitleAttr = useBlockAttributeChanges(
		clientId,
		"itmar/design-title",
		"itmar_filter_title",
		innerFlattenedBlocks,
		{ headingContent: "" },
	);
	console.log(changeTitleAttr);

	useEffect(() => {
		if (changeTitleAttr) {
			setAttributes({ titleAttributes: changeTitleAttr.attributes });
			//console.log(JSON.stringify(changeTitleAttr.attributes));
		}
	}, [changeTitleAttr]);

	useEffect(() => {
		if (innerBlocks[0]) {
			//グループブロックの属性を記録
			setAttributes({ groupBlockAttributes: innerBlocks[0].attributes });

			//最初に見つかったitmar_filter_searchboxブロック
			const searchBoxBolck = innerFlattenedBlocks.find(
				(block) =>
					block.name === "itmar/design-text-ctrl" &&
					block.attributes.className?.includes("itmar_filter_searchbox"),
			);
			//属性を記録
			if (searchBoxBolck) {
				setAttributes({ searchBoxAttributes: searchBoxBolck.attributes });
			}
			//最初に見つかったitmar_filter_searchbuttonブロック
			const searchButtonBolck = allFlattenedBlocks.find(
				(block) =>
					block.name === "itmar/design-button" &&
					block.attributes.className === "itmar_filter_searchbutton",
			);
			//属性を記録
			if (searchButtonBolck) {
				setAttributes({ searchButtonAttributes: searchButtonBolck.attributes });
			}

			//最初に見つかったitmar_filter_yearブロック
			const yearRadioBolck = allFlattenedBlocks.find(
				(block) =>
					block.name === "itmar/design-radio" &&
					block.attributes.className?.split(" ").includes("itmar_filter_year"),
			);
			//ブロックの属性を記録
			if (yearRadioBolck) {
				setAttributes({ yearAttributes: yearRadioBolck.attributes });
			}

			//最初に見つかったitmar_filter_monthブロック
			const monthRadioBolck = allFlattenedBlocks.find(
				(block) =>
					block.name === "itmar/design-radio" &&
					block.attributes.className?.split(" ").includes("itmar_filter_month"),
			);
			//ブロックの属性を記録
			if (monthRadioBolck) {
				setAttributes({ monthAttributes: monthRadioBolck.attributes });
			}

			//最初に見つかったitmar_filter_dayブロック
			const dayCalenderBolck = allFlattenedBlocks.find(
				(block) =>
					block.name === "itmar/design-calender" &&
					block.attributes.className?.split(" ").includes("itmar_filter_day"),
			);

			//ブロックの属性を記録
			if (dayCalenderBolck) {
				setAttributes({ dayAttributes: dayCalenderBolck.attributes });
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

	//チェックボックスブロック・期間ブロックの属性変更（クリック）
	useEffect(() => {
		//pickUpが存在しないときは処理しない
		if (!pickup) return;
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

			//タクソノミーの選択に変化があるときだけ属性を変更(タクソノミー情報取得後)
			if (
				!_.isEqual(selTerms, pickup?.attributes.choiceTerms) &&
				isfilterReady
			) {
				updateBlockAttributes(pickup?.clientId, {
					choiceTerms: selTerms,
					currentPage: 0, //カレントページも０にもどす
				});
			}
		}
		//日付によるフィルタ
		if (periodBlocks.length > 0) {
			const priodAttr = periodBlocks[0].attributes;
			//発見できた属性名で日、月、年の峻別
			const savePeriod =
				priodAttr.selectedMonth && priodAttr.selectedValue
					? `${priodAttr.selectedMonth}/${priodAttr.selectedValue
							.toString()
							.padStart(2, "0")}`
					: priodAttr.selectedValues
					? priodAttr.selectedValues
					: "";
			//期間の選択に変化があるときだけ属性を変更
			if (savePeriod != pickup.attributes.choicePeriod) {
				updateBlockAttributes(pickup.clientId, {
					choicePeriod: savePeriod,
					currentPage: 0, //カレントページも０にもどす
				});
			}
		}
		//検索ボックスによるフィルタ
		if (searchButton) {
			if (searchButton.attributes.isClick) {
				updateBlockAttributes(searchButton.clientId, {
					isClick: false, //クリックフラグをもどす
				});
				//検索キーワードをpickupの属性にセット
				const keyWord = searchBox.attributes.inputValue;
				updateBlockAttributes(pickup.clientId, {
					searchWord: keyWord,
					currentPage: 0, //カレントページも０にもどす
				});
			}
		}
		//検索対象のカスタムフィールド
		if (searchFields) {
			//検索対象のカスタムフィールドをpickupの属性にセット
			updateBlockAttributes(pickup.clientId, {
				searchFields: searchFields,
			});
		}
	}, [
		checkboxBlocks,
		periodBlocks,
		pickup,
		filterItems,
		searchButton,
		searchFields,
	]);

	//今日の日付
	const today = new Date();

	//フィルタ要素をタクソノミーのフィルタと、日付・検索のフィルタに分離
	const taxFilters = filterItems.filter(
		(filter) => !["date", "search"].includes(filter.value),
	);
	const specialFilters = filterItems.filter((filter) =>
		["date", "search"].includes(filter.value),
	);

	//フィルタの選択に使用するチェックボックス
	const FilterCheckbox = ({ filter, isChecked }) => {
		return (
			<CheckboxControl
				className="filter_check"
				label={filter.label}
				checked={isChecked}
				onChange={(checked) => {
					// targetが重複していない場合のみ追加
					if (checked) {
						if (!setFilters.some((item) => _.isEqual(item, filter.value))) {
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
	};

	//pickupで登録されたカスタムフィールド
	const pickupCustomFields = pickup?.attributes.blockMap;
	//カスタムキーでないフィールド
	const excludedKeys = ["title", "date", "excerpt"];

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
					{specialFilters.map((filter, index) => {
						const isChecked = setFilters.some(
							(setFilter) => setFilter === filter.value,
						);
						//フィルタ用パネルのラベル
						const panel_label =
							filter.value === "date"
								? __("Date filter Setting", "post-blocks")
								: filter.value === "search"
								? __("Search filter Setting", "post-blocks")
								: "";
						return (
							<PanelBody
								key={index}
								title={panel_label}
								initialOpen={true}
								className="form_setteing_ctrl"
							>
								<FilterCheckbox filter={filter} isChecked={isChecked} />
								{filter.value === "search" &&
									isChecked &&
									pickupCustomFields &&
									Object.keys(pickupCustomFields).length > 0 && (
										<PanelBody
											title={__("Custom fields to select", "post-blocks")}
											initialOpen={true}
											className="form_setteing_ctrl"
										>
											{Object.entries(pickupCustomFields).map(
												([key, value]) => {
													const isChecked = searchFields.some(
														(searchField) => searchField === key,
													);
													return !excludedKeys.includes(key) &&
														(value === "itmar/design-title" ||
															value === "core/paragraph") ? (
														<CheckboxControl
															key={key}
															label={key}
															checked={isChecked}
															onChange={(checked) => {
																// targetが重複していない場合のみ追加
																if (checked) {
																	if (
																		!searchFields.some((item) =>
																			_.isEqual(item, key),
																		)
																	) {
																		setAttributes({
																			searchFields: [...searchFields, key],
																		});
																	}
																} else {
																	// targetを配列から削除
																	setAttributes({
																		searchFields: searchFields.filter(
																			(item) => !_.isEqual(item, key),
																		),
																	});
																}
															}}
														/>
													) : null;
												},
											)}
										</PanelBody>
									)}
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
							</PanelBody>
						);
					})}
					<PanelBody
						title={__("Taxonomy Setting", "post-blocks")}
						initialOpen={true}
						className="form_setteing_ctrl"
					>
						{taxFilters.map((filter, index) => {
							const isChecked = setFilters.some(
								(setFilter) => setFilter === filter.value,
							);

							return (
								<FilterCheckbox
									key={index}
									filter={filter}
									isChecked={isChecked}
								/>
							);
						})}
					</PanelBody>
				</PanelBody>
			</InspectorControls>

			<div {...blockProps}>
				<div {...innerBlocksProps}></div>
			</div>
		</>
	);
}
