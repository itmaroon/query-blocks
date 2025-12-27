import { useSelect, useDispatch } from "@wordpress/data";
import isEqual from "lodash/isEqual";

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
	RadioControl,
	CheckboxControl,
	Notice,
	RangeControl,
	TextControl,
	SelectControl,
} from "@wordpress/components";
import { useEffect, useState, useRef } from "@wordpress/element";
import { createBlock } from "@wordpress/blocks";

import {
	ArchiveSelectControl,
	TermChoiceControl,
	FieldChoiceControl,
	useRebuildChangeField,
	serializeBlockTree,
	createBlockTree,
	getPeriodQuery,
	restFieldes,
} from "itmar-block-packages";

//階層化されたフィールドオブジェクトを.つなぎの文字列にする関数
const custumFieldsToString = (obj, prefix = "") => {
	return Object.entries(obj).flatMap(([key, value]) => {
		const fieldName = prefix ? `${prefix}.${key}` : key; //prefixはグループ名

		if (typeof value === "object" && value !== null && key != "acf_gallery") {
			return custumFieldsToString(value, fieldName);
		} else {
			return fieldName;
		}
	});
};

export default function Edit({ attributes, setAttributes, clientId }) {
	const {
		pickupId,
		pickupType,
		pickupQuery,
		selectedSlug,
		selectedRest,
		choiceTerms,
		dispTaxonomies,
		taxRelateType,
		choiceFields,
		choicePeriod,
		searchWord,
		searchFields,
		numberOfItems,
		posts,
		numberOfTotal,
		currentPage,
		blockMap,
		blocksAttributesArray,
		emptyMessageAttributes,
		emptyGroupAttributes,
	} = attributes;

	// dispatch関数を取得
	const { replaceInnerBlocks } = useDispatch("core/block-editor");

	const style_disp = [
		__("For landscape images, odd numbers", "query-bloks"),
		__("For landscape images, even numbers", "query-bloks"),
		__("For portrait images, odd numbers", "query-bloks"),
		__("For portrait images, even numbers", "query-bloks"),
	];

	//インナーブロックのひな型を用意
	const TEMPLATE = [];
	const blockProps = useBlockProps();
	const innerBlocksProps = useInnerBlocksProps(blockProps, {
		allowedBlocks: [
			"itmar/design-group",
			"itmar/design-title",
			"core/image",
			"core/paragraph",
			"itmar/design-button",
		],
		template: TEMPLATE,
		templateLock: false,
	});

	//第一階層のインナーブロックの取得
	const { innerBlocks, parentBlock, parentId } = useSelect(
		(select) => {
			const { getBlocks, getBlockParents, getBlock } =
				select("core/block-editor");
			const parentIds = getBlockParents(clientId);
			return {
				innerBlocks: getBlocks(clientId),
				parentBlock:
					parentIds.length > 0
						? getBlock(parentIds[parentIds.length - 1])
						: null,
				parentId: parentIds[parentIds.length - 1],
			};
		},
		[clientId],
	);

	//ブロック属性の更新処理
	useEffect(() => {
		if (innerBlocks.length > 0) {
			const serialized = innerBlocks.map(serializeBlockTree);
			setAttributes({ blocksAttributesArray: serialized });
		}
	}, [innerBlocks]);
	//親がitmar/slide-mvの場合のブロック属性の更新処理
	useEffect(() => {
		if (!parentBlock || parentBlock.name !== "itmar/slide-mv") return;

		const slide_innerBlocks = parentBlock.innerBlocks.filter(
			(block) => block.name !== "itmar/pickup-posts",
		);

		if (slide_innerBlocks.length === 0) return;

		const serialized = slide_innerBlocks.map(serializeBlockTree);

		// すでに同じ内容なら setAttributes しない
		if (!isEqual(serialized, attributes.blocksAttributesArray)) {
			setAttributes({ blocksAttributesArray: serialized });
		}
	}, [parentBlock?.innerBlocks, parentBlock?.name]);

	//ポストタイプによってblockMapに書き込まれたカスタムフィールドの情報を更新
	useEffect(() => {
		//ポストタイプの指定がないときは処理しない
		if (selectedRest) {
			const fetchData = async () => {
				try {
					//フィールド情報を取得
					const fetchFields = await restFieldes(selectedRest);

					//フィールド情報からカスタムフィールド情報を抜き出し
					const customFieldsObj = {
						...Object.entries(fetchFields[0].meta).reduce(
							(acc, [key, value]) => ({
								...acc,
								[`meta_${key}`]: value,
							}),
							{},
						),
						...Object.entries(fetchFields[0].acf)
							// acf は「同名で _source があるもののベース側を除く」
							.filter(([key]) => !key.endsWith("_source"))
							.reduce(
								(acc, [key, value]) => ({
									...acc,
									[`acf_${key}`]: value,
								}),
								{},
							),
					};

					//カスタムフィール情報を平坦化して_acf_changedとfootnotesを除外
					const customFieldsArray = custumFieldsToString(
						customFieldsObj,
					).filter(
						(field) =>
							field !== "meta__acf_changed" && field !== "meta_footnotes",
					);

					//プレフィックスを削除した配列
					// const normalizedFieldsArray = customFieldsArray.map((field) =>
					// 	field.replace(/^(meta_|acf_)/, ""),
					// );

					// カスタムフィールド情報にないものをフィルタリング
					// これらのキーは常に保持する
					const alwaysKeep = [
						"title",
						"content",
						"date",
						"excerpt",
						"featured_media",
						"link",
					];
					const filteredBlockMap = Object.fromEntries(
						Object.entries(blockMap).filter(
							([key]) =>
								customFieldsArray.includes(key) || alwaysKeep.includes(key),
						),
					);

					customFieldsArray.forEach((field) => {
						if (!filteredBlockMap.hasOwnProperty(field)) {
							filteredBlockMap[field] = "itmar/design-title";
						}
					});

					//blockMapを書き換え
					const newBlockMap = {
						...filteredBlockMap,
					};

					setAttributes({ blockMap: newBlockMap });
					//choiceFieldsから登録されていないカスタムフィールドを除外
					const filterChoiceFields = choiceFields.filter(
						(field) =>
							customFieldsArray.includes(field) || alwaysKeep.includes(field),
					);
					setAttributes({ choiceFields: filterChoiceFields });
				} catch (error) {
					console.error("Error fetching data:", error.message);
				}
			};
			fetchData();
		}
	}, [selectedRest]);

	//フィールド選択による表示ブロック情報の生成
	const [selectedFields, setSelectedFields] = useState([]);
	useEffect(() => {
		const field_choices = choiceFields
			.map((key) => {
				const block = blockMap[key];
				if (!block) return null; // blockMapにないキーはスキップ

				return {
					key, // そのままキー
					label: __(key, "query-blocks"), // ラベルはキーをもとに翻訳
					block, // 値はblockMapの値
				};
			})
			.filter(Boolean);

		setSelectedFields(field_choices);
	}, [choiceFields, blockMap]);

	//表示フィールド変更によるインナーブロックの再構成
	//ペースト対象のチェック配列
	const sectionCount =
		pickupType === "single"
			? 1
			: parentBlock?.name === "itmar/slide-mv"
			? parentBlock?.attributes.slideInfo.defaultPerView + 2
			: 4;
	const domType = parentBlock?.name === "itmar/slide-mv" ? "div" : "form";
	const insert_id =
		parentBlock?.name === "itmar/slide-mv" ? parentId : clientId;
	useRebuildChangeField(
		blocksAttributesArray,
		selectedFields,
		pickupType,
		dispTaxonomies,
		sectionCount,
		domType,
		clientId,
		insert_id,
	);

	//ペースト対象のチェック配列
	const [isCopyChecked, setIsCopyChecked] = useState([]);
	//CheckBoxのイベントハンドラ
	const handleCheckboxChange = (index, newCheckedValue) => {
		const updatedIsChecked = [...isCopyChecked];
		updatedIsChecked[index] = newCheckedValue;
		setIsCopyChecked(updatedIsChecked);
	};

	//Noticeのインデックス保持
	const [noticeClickedIndex, setNoticeClickedIndex] = useState(null);
	//貼付け中のフラグ保持
	const [isPastWait, setIsPastWait] = useState(false);

	//レンダリング
	return (
		<>
			<InspectorControls group="settings">
				<PanelBody title={__("Content Settings", "query-blocks")}>
					<TextControl
						label={__("Pickup ID", "query-blocks")}
						value={pickupId}
						onChange={(value) => setAttributes({ pickupId: value })}
					/>
					<ArchiveSelectControl
						selectedSlug={selectedSlug}
						label={__("Select Post Type", "query-blocks")}
						homeUrl={query_blocks.home_url}
						onChange={(postInfo) => {
							if (postInfo) {
								setAttributes({
									selectedSlug: postInfo.slug,
									selectedRest: postInfo.rest_base,
								});
							}
						}}
					/>

					<SelectControl
						label={__("Select Query Type", "query-blocks")}
						value={pickupQuery}
						options={[
							{ label: __("Nomal", "query-blocks"), value: "nomal" },
							{ label: __("Popular", "query-blocks"), value: "popular" },
						]}
						onChange={(changeOption) => {
							setAttributes({ pickupQuery: changeOption });
						}}
					/>

					<div className="itmar_title_type">
						<RadioControl
							label={__("Pickup Post Type", "query-blocks")}
							selected={pickupType}
							options={[
								{ label: __("Muluti Post", "query-blocks"), value: "multi" },
								{ label: __("Single Post", "query-blocks"), value: "single" },
							]}
							onChange={(changeOption) =>
								setAttributes({ pickupType: changeOption })
							}
						/>
					</div>

					<PanelBody title={__("Choice Taxsonomy", "query-blocks")}>
						<div className="itmar_title_type">
							<RadioControl
								label={__(
									"The relationship between taxonomies",
									"query-blocks",
								)}
								selected={taxRelateType}
								options={[
									{ label: "AND", value: "AND" },
									{ label: "OR", value: "OR" },
								]}
								onChange={(changeOption) =>
									setAttributes({ taxRelateType: changeOption })
								}
							/>
						</div>
						<TermChoiceControl
							type="taxonomy"
							selectedSlug={selectedSlug}
							choiceItems={choiceTerms}
							dispTaxonomies={dispTaxonomies}
							onChange={(newChoiceTerms) => {
								setAttributes({ choiceTerms: newChoiceTerms });
							}}
							onSetDispTax={(newChoiceTerms) => {
								setAttributes({ dispTaxonomies: newChoiceTerms });
							}}
						/>
					</PanelBody>

					<PanelBody title={__("Choice Field", "query-blocks")}>
						<FieldChoiceControl
							type="field"
							selectedSlug={selectedRest}
							choiceItems={choiceFields}
							blockMap={blockMap}
							textDomain="query-blocks"
							onChange={(newChoiceFields) => {
								//選択されたフィールド名の配列を登録
								setAttributes({ choiceFields: newChoiceFields });
							}}
							onBlockMapChange={(newBlockMap) => {
								setAttributes({ blockMap: newBlockMap });
							}}
						/>
					</PanelBody>
					{pickupType === "multi" && (
						<PanelRow className="itmar_post_blocks_pannel">
							<RangeControl
								value={numberOfItems}
								label={__("Display Num", "query-blocks")}
								max={30}
								min={1}
								onChange={(val) => setAttributes({ numberOfItems: val })}
							/>
						</PanelRow>
					)}
				</PanelBody>
			</InspectorControls>
			<InspectorControls group="styles">
				<PanelBody title={__("Unit Style Copy&Past", "query-blocks")}>
					<div className="itmar_post_block_notice">
						{blocksAttributesArray.map((styleObj, index) => {
							const copyBtn = {
								label: __("Copy", "query-blocks"),
								onClick: () => {
									//CopyがクリックされたNoticeの順番を記録
									setNoticeClickedIndex(index);
								},
							};
							const pastBtn = {
								label: isPastWait ? (
									<img
										src={`${query_blocks.plugin_url}/assets/past-wait.gif`}
										alt={__("wait", "query-blocks")}
										style={{ width: "36px", height: "36px" }} // サイズ調整
									/>
								) : (
									__("Paste", "query-blocks")
								),
								onClick: () => {
									//貼付け中フラグをオン
									setIsPastWait(true);

									//記録された順番の書式をコピー
									if (noticeClickedIndex !== null) {
										//blocksAttributesArrayのクローンを作成
										const updatedBlocksAttributes = [...blocksAttributesArray];
										//ペースト対象配列にチェックが入った順番のものにペースト

										const newInnerBlocks =
											parentBlock.name === "itmar/slide-mv"
												? [...parentBlock.innerBlocks]
												: [...innerBlocks];

										isCopyChecked.forEach((checked, index) => {
											if (checked) {
												const replaceBlock = createBlockTree(
													blocksAttributesArray[noticeClickedIndex],
												);
												newInnerBlocks[index] = replaceBlock;
												//ブロック属性に格納した配列の要素を入れ替える
												updatedBlocksAttributes[index] =
													blocksAttributesArray[noticeClickedIndex];
											}
										});
										//元のブロックと入れ替え
										const insert_id =
											parentBlock?.name === "itmar/slide-mv"
												? parentId
												: clientId;
										replaceInnerBlocks(insert_id, newInnerBlocks, false);

										//属性を変更
										setAttributes({
											blocksAttributesArray: updatedBlocksAttributes,
										});

										//貼付け中フラグをオフ
										setIsPastWait(false);
										setNoticeClickedIndex(null); //保持を解除
										//ペースト対象配列の初期化
										setIsCopyChecked(
											Array(blocksAttributesArray.length).fill(false),
										);
									}
								},
							};
							const actions =
								noticeClickedIndex === index ? [pastBtn] : [copyBtn];
							const checkInfo = __(
								"Check the unit to which you want to paste and press the Paste button.",
								"query-blocks",
							);
							const checkContent =
								noticeClickedIndex != index ? (
									<CheckboxControl
										label={__("Paste to", "query-blocks")}
										checked={isCopyChecked[index]}
										onChange={(newVal) => {
											handleCheckboxChange(index, newVal);
										}}
									/>
								) : (
									<p>{checkInfo}</p>
								);

							return (
								<div className="style_unit">
									<Notice
										key={index}
										actions={actions}
										status={
											noticeClickedIndex === index ? "success" : "default"
										}
										isDismissible={false}
									>
										<div>
											<p>{`Unit ${index + 1} Style`}</p>
											<p>
												{parentBlock?.name !== "itmar/slide-mv"
													? style_disp[index]
													: ""}
											</p>
										</div>
									</Notice>
									<div className="past_state">{checkContent}</div>
								</div>
							);
						})}
					</div>
				</PanelBody>
			</InspectorControls>

			{/* 親ブロックがitmar/slide-mvのときはレンダリングしない */}
			{(!parentBlock || parentBlock.name !== "itmar/slide-mv") && (
				<div className="outer_frame">
					<div className="edit_area">
						<div {...innerBlocksProps} />
					</div>
				</div>
			)}
		</>
	);
}
