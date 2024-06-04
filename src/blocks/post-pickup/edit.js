import { useSelect, useDispatch } from "@wordpress/data";
import { __ } from "@wordpress/i18n";
import {
	dateI18n, // 日付をフォーマットし、サイトのロケールに変換
	format, // 日付のフォーマット
} from "@wordpress/date";
import "./editor.scss";

import {
	useBlockProps,
	useInnerBlocksProps,
	InspectorControls,
} from "@wordpress/block-editor";

import {
	PanelBody,
	PanelRow,
	QueryControls,
	RadioControl,
} from "@wordpress/components";
import { useEffect, useState } from "@wordpress/element";
import { createBlock } from "@wordpress/blocks";

import {
	ArchiveSelectControl,
	TermChoiceControl,
	FieldChoiceControl,
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

//再帰的に下の階層までブロックの属性を拾い出す関数
const getBlockAttributes = (block) => {
	const attributes = {
		blockId: block.clientId,
		blockName: block.name,
		attributes: block.attributes,
	};

	if (block.innerBlocks.length > 0) {
		attributes.innerBlocks = block.innerBlocks.map(getBlockAttributes);
	}

	return attributes;
};

//インナーブロックの情報から新しいブロックを生成する関数
const createBlocksFromObject = (blockObject) => {
	const { blockName, attributes, innerBlocks } = blockObject;

	let innerBlocksArray = [];
	if (innerBlocks && Array.isArray(innerBlocks)) {
		innerBlocksArray = innerBlocks.map(createBlocksFromObject);
	}

	return createBlock(blockName, attributes, innerBlocksArray);
};

//ブロックにクラス名が含まれるかを判定する関数
const hasMatchingClassName = (blockObject, field, overrideAttributes) => {
	// blockObjectがundefinedまたはnullの場合はfalseを返す
	if (!blockObject) {
		return false;
	}

	// blockObject.attributesがundefinedまたはnullの場合はfalseを返す
	if (!blockObject.attributes) {
		return false;
	}

	// blockObject.attributes.classNameがundefinedまたはnullの場合は空文字列を設定
	const className = blockObject.attributes.className || "";

	// choiceFieldsがundefinedまたはnullの場合はfalseを返す
	if (!field) {
		return false;
	}

	// classNameから"field_"が付いているクラス名を抽出
	const fieldClasses = className
		.split(" ")
		.filter((cls) => cls.startsWith("field_"));

	// 抽出したクラス名から"field_"を取り除く
	const classNames = fieldClasses.map((cls) => cls.replace("field_", ""));

	// クラス名が存在すればtrueをかえす
	for (const className of classNames) {
		if (field === className) {
			// 一致するクラス名が見つかった場合は、overrideAttributesで属性を上書き
			Object.assign(blockObject.attributes, overrideAttributes);
			return true;
		}
	}

	// hasMatchがfalseで、innerBlocksが存在する場合は、再帰的に探索
	if (blockObject.innerBlocks && blockObject.innerBlocks.length > 0) {
		return blockObject.innerBlocks.some((innerBlock) =>
			hasMatchingClassName(innerBlock, field, overrideAttributes),
		);
	}

	// 一致するclassNameが見つからなかった場合はfalseを返す
	return false;
};

//選択したフィールドにないブロックを削除する関数
const removeNonMatchingClassName = (blockObject, choiceFields) => {
	// blockObjectがundefinedまたはnullの場合は何もしない
	if (!blockObject) {
		return;
	}

	// blockObject.attributesがundefinedまたはnullの場合は何もしない
	if (!blockObject.attributes) {
		return;
	}

	// blockObject.attributes.classNameがundefinedまたはnullの場合は空文字列を設定
	const className = blockObject.attributes.className || "";

	// choiceFieldsがundefinedまたはnullの場合は何もしない
	if (!choiceFields) {
		return;
	}

	// classNameから"field_"が付いているクラス名を抽出
	const fieldClasses = className
		.split(" ")
		.filter((cls) => cls.startsWith("field_"));

	// 抽出したクラス名から"field_"を取り除く
	const fields = fieldClasses.map((cls) => cls.replace("field_", ""));

	// fieldsを一つずつ取り出して、choiceFieldsに含まれていない場合はblockObjectを削除
	for (const field of fields) {
		if (!choiceFields.includes(field)) {
			return null;
		}
	}

	// innerBlocksが存在する場合は、再帰的に探索
	if (blockObject.innerBlocks && blockObject.innerBlocks.length > 0) {
		blockObject.innerBlocks = blockObject.innerBlocks
			.map((innerBlock) => removeNonMatchingClassName(innerBlock, choiceFields))
			.filter((innerBlock) => innerBlock !== null);
	}

	return blockObject;
};

export default function Edit({ attributes, setAttributes, clientId }) {
	const {
		selectedSlug,
		selectedRest,
		choiceTerms,
		taxRelateType,
		choiceFields,
		numberOfItems,
		blockMap,
		blocksAttributesArray,
	} = attributes;

	// dispatch関数を取得
	const { replaceInnerBlocks } = useDispatch("core/block-editor");

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
			tax_relation: taxRelateType,
		};
	};

	//coreストアからpostオブジェクトを取得する
	const [posts, setPosts] = useState([]);
	useSelect(
		(select) => {
			const { getEntityRecords } = select("core");
			const taxonomyTerms = getSelectedTaxonomyTerms();
			const getPost = getEntityRecords("postType", selectedSlug, {
				per_page: numberOfItems,
				_embed: true,
				...taxonomyTerms,
			});
			setPosts(getPost);
		},
		[numberOfItems, selectedSlug, choiceTerms, taxRelateType],
	);
	//インナーブロックのひな型を用意
	const TEMPLATE = [];
	const blockProps = useBlockProps();
	const innerBlocksProps = useInnerBlocksProps(blockProps, {
		allowedBlocks: [
			"itmar/design-group",
			"itmar/design-title",
			"core/image",
			"core/paragraph",
		],
		template: TEMPLATE,
		templateLock: false,
	});

	//第一階層のインナーブロックの取得
	const { innerBlocks } = useSelect(
		(select) => ({
			innerBlocks: select("core/block-editor").getBlocks(clientId),
		}),
		[clientId],
	);

	//投稿データの抽出および表示フィールド変更に基づく再レンダリング
	useEffect(() => {
		if (!posts) {
			return; //postsが返っていなければ処理しない。
		}

		//postの数分のデータを生成
		const blocksArray = [];
		posts.forEach((post, index) => {
			//blocksAttributesArray[index]が{}ならitmar/design-groupブロックを挿入
			if (Object.keys(blocksAttributesArray[index]).length === 0) {
				Object.assign(blocksAttributesArray[index], {
					blockName: "itmar/design-group",
					attributes: {},
				});
			}

			//追加するブロック
			const addBlocks = [];

			//すでにブロックの属性にフィールドのブロックが登録されているかを検査
			for (const field of choiceFields) {
				//postデータに応じた属性の初期値を生成
				const blockAttributes =
					field === "title"
						? {
								className: "field_title",
								headingContent: post.title.rendered
									? post.title.rendered
									: __("No title", "post-blocks"),
						  }
						: field === "date"
						? {
								className: "field_date",
								headingContent: dateI18n("Y.n.j", post.date_gmt),
						  }
						: field === "featured_media"
						? {
								className: "itmar_ex_block field_featured_media",
								url: post._embedded["wp:featuredmedia"][0].media_details.sizes
									.medium.source_url,
						  }
						: field === "excerpt"
						? {
								className: "itmar_ex_block field_excerpt",
								content: post.excerpt.rendered
									? post.excerpt.rendered.replace(/<\/?p>/g, "") //pタグを除去する
									: __("No excerpt", "post-blocks"),
						  }
						: {};
				//innerBlocksAttributesに指定されたフィールド用ブロックが存在するか
				const is_field = hasMatchingClassName(
					blocksAttributesArray[index],
					field,
					blockAttributes,
				);

				if (!is_field) {
					//登録されていなければinnerBlocksAttributesにフィールド用ブロックを追加
					const blockname = blockMap[field];
					addBlocks.push({ blockName: blockname, attributes: blockAttributes });
				}
			}
			//追加すべきフィールド表示用ブロックがあれば追加

			if (addBlocks.length > 0) {
				if (!blocksAttributesArray[index].innerBlocks) {
					// innerBlocksAttributesにinnerBlocksキーが存在しない場合は新しく追加
					Object.assign(blocksAttributesArray[index], {
						innerBlocks: addBlocks,
					});
				} else {
					// innerBlocksAttributesにinnerBlocksキーが存在する場合は既存の配列に追加
					blocksAttributesArray[index].innerBlocks.push(...addBlocks);
				}
			}
			//選択されていないフィールドのブロックがあれば削除
			const filteredBlockObject = removeNonMatchingClassName(
				blocksAttributesArray[index],
				choiceFields,
			);
			//filteredBlockObjectからreplaceInnerBlocks用のブロックオブジェクトを生成し、インナーブロックをレンダリング
			const blocksObj = createBlocksFromObject(filteredBlockObject);

			//インナーブロックを配列にpush
			blocksArray.push(blocksObj);
		});
		replaceInnerBlocks(clientId, blocksArray, false);
	}, [posts, choiceFields]);

	//インナーブロック変更による属性の変更
	useEffect(() => {
		if (innerBlocks.length > 0) {
			const blockAttrArray = [];
			innerBlocks.forEach((unitBlock) => {
				const unitAttribute = getBlockAttributes(unitBlock);
				blockAttrArray.push(unitAttribute);
			});
			if (!_.isEqual(blockAttrArray, blocksAttributesArray)) {
				setAttributes({ blocksAttributesArray: blockAttrArray });
			}
		}
	}, [innerBlocks]);

	//レンダリング
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
						<div className="itmar_select_row">
							<RadioControl
								label={__("The relationship between taxonomies", "post-blocks")}
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
				</PanelBody>
			</InspectorControls>

			<div className="outer_frame">
				<div className="edit_area">
					<div {...innerBlocksProps} />
				</div>
			</div>
		</>
	);
}
