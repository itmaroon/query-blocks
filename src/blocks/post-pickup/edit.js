import { useSelect, useDispatch } from "@wordpress/data";
import { store as editorStore } from "@wordpress/editor";

import { __ } from "@wordpress/i18n";

import "./editor.scss";
import apiFetch from "@wordpress/api-fetch";
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
	getPeriodQuery,
	restFieldes,
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

//ネストされたオブジェクトを作成する関数
const createNestedObject = (names, value) => {
	const result = {};
	let current = result;

	for (let i = 0; i < names.length - 1; i++) {
		current[names[i]] = {};
		current = current[names[i]];
	}

	current[names[names.length - 1]] = value;
	return result;
};
//ネストされたオブジェクトを上書きせずマージする関数
function mergeNestedObjects(target, source) {
	for (let key in source) {
		if (source.hasOwnProperty(key)) {
			// RichTextの戻り値をオブジェクトとして持つ場合はそのままコピー
			if (
				source[key] &&
				typeof source[key] === "object" &&
				(Object.getOwnPropertyNames(source[key]).length == 0 || // RichTextの戻り値はキーを検出できないオブジェクト
					(Object.getOwnPropertyNames(source[key]).length <= 1 &&
						source[key].hasOwnProperty("originalHTML"))) //// RichTextの戻り値はoriginalHTMLをキーとするオブジェクトを持つときがある
			) {
				target[key] = source[key];
			} else if (source[key] instanceof Object && !Array.isArray(source[key])) {
				// ネストされたオブジェクトは上書きせずにマージ
				target[key] = target[key] || {};
				mergeNestedObjects(target[key], source[key]);
			} else {
				target[key] = source[key];
			}
		}
	}

	return target;
}

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
const createBlocksFromObject = async (blockObject) => {
	const { blockName, attributes, innerBlocks } = blockObject;

	let innerBlocksArray = [];
	if (innerBlocks && Array.isArray(innerBlocks)) {
		const innerBlocksPromises = innerBlocks.map(createBlocksFromObject);
		//インナーブロックのPromise解決
		innerBlocksArray = await Promise.all(innerBlocksPromises);
	}
	//ブロックがdesign-groupでblockNumがnull（投稿データのないインナーブロック）の場合
	//（参考）design-groupのblockNumはデフォルトで1
	if (blockName === "itmar/design-group" && attributes.blockNum == null) {
		return createBlock(
			blockName,
			{ ...attributes, className: "post_empty" }, //post_emptyクラスをつけて格納
			innerBlocksArray,
		);
	} else if (
		blockName === "itmar/design-group" &&
		attributes.blockNum != null
	) {
		const { className, ...newAttributes } = attributes; //クラス名を外す
		return createBlock(blockName, newAttributes, innerBlocksArray);
	}
	//ブロックがコアイメージでidが設定されている場合
	if (blockName === "core/image" && attributes.id) {
		try {
			const path = `/wp/v2/media/${attributes.id}`;
			const mediaInfo = await apiFetch({ path });
			const newAttributes = {
				...attributes,
				url: mediaInfo.source_url,
				alt: mediaInfo.alt_text,
			}; //idをぬいてurlとaltを足す
			return createBlock(blockName, newAttributes, innerBlocksArray);
		} catch (error) {
			console.error("Error fetching image data:", error);
			const newAttributes = {
				...attributes,
				alt: "Error fetching image data",
			}; //idをぬいてurlとaltを足す
			return createBlock(blockName, newAttributes, innerBlocksArray);
		}
	} else if (blockName === "core/image" && !attributes.id) {
		//const { url, alt, ...newAttributes } = attributes;
		//urlとaltを抜く
		return createBlock(blockName, attributes, innerBlocksArray);
	}
	//その他のブロック
	return createBlock(blockName, attributes, innerBlocksArray);
};

//ブロックにクラス名が含まれるかを判定する関数
const hasMatchingClassName = (
	blockObject,
	field,
	blockName,
	overrideAttributes,
	isChangeId,
) => {
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
		.filter((cls) => cls.startsWith("field_") || cls.startsWith("term_"));

	// 抽出したクラス名から"field_"を取り除く
	const classNames = fieldClasses.map((cls) =>
		cls.replace(/^(field_|term_)/, ""),
	);

	// クラス名が存在すればtrueをかえす
	for (const className of classNames) {
		if (field === className) {
			// 一致するクラス名が見つかった場合は、overrideAttributesで属性を上書き
			if (blockObject.blockName === blockName) {
				const updatedAttributes = { ...overrideAttributes };
				//既にフィールドを表すクラスがセットされているときは元のクラス名を維持する
				if (
					blockObject.attributes.className?.includes(
						overrideAttributes.className,
					)
				) {
					// 既存のclassNameを保持
					updatedAttributes.className = blockObject.attributes.className;
				}

				Object.assign(blockObject.attributes, updatedAttributes);
			} else {
				blockObject.attributes = overrideAttributes; //blockNameが変わった時はすべての属性を入れ替え
			}

			blockObject.blockName = blockName;
			return true;
		}
	}

	// hasMatchがfalseで、innerBlocksが存在する場合は、再帰的に探索
	if (blockObject.innerBlocks && blockObject.innerBlocks.length > 0) {
		return blockObject.innerBlocks.some((innerBlock) =>
			hasMatchingClassName(
				innerBlock,
				field,
				blockName,
				overrideAttributes,
				isChangeId,
			),
		);
	}

	// 一致するclassNameが見つからなかった場合はfalseを返す
	return false;
};

//クラス名にfield_が含まれるblockObjectからフィールド名と値を返す関数
const FieldClassNameObj = (blockObject, fieldKind) => {
	// blockObjectがundefinedまたはnullの場合はfalseを返す
	if (!blockObject) {
		return [];
	}

	// blockObject.attributesがundefinedまたはnullの場合はfalseを返す
	if (!blockObject.attributes) {
		return [];
	}

	// blockObject.attributes.classNameがundefinedまたはnullの場合は空文字列を設定
	const className = blockObject.attributes.className || "";

	// classNameから"field_"が付いているクラス名を抽出
	const fieldClasses = className
		.split(" ")
		.filter((cls) => cls.startsWith(fieldKind));

	// 抽出したクラス名から"field_"を取り除く
	const classNames = fieldClasses.map((cls) => cls.replace(fieldKind, ""));
	// innerBlocksが存在する場合は、再帰的に探索
	if (blockObject.innerBlocks && blockObject.innerBlocks.length > 0) {
		const innerClassNames = blockObject.innerBlocks.flatMap((innerBlock) => {
			return FieldClassNameObj(innerBlock, fieldKind);
		});
		return [...classNames, ...innerClassNames];
	}
	// classNamesが空配列ではない場合、classNamesの最初の要素とblockObjectをペアにしたオブジェクトを要素とする配列を返す
	if (classNames.length > 0) {
		const fieldValue =
			blockObject.blockName === "itmar/design-title" &&
			!blockObject.attributes.className.includes("itmar_link_block")
				? blockObject.attributes.headingContent
				: blockObject.blockName === "core/paragraph"
				? blockObject.attributes.content
				: blockObject.blockName === "core/image"
				? blockObject.attributes.id
				: "";
		return [{ fieldName: classNames[0], fieldValue: fieldValue }];
	} else {
		return [];
	}
};

//選択したフィールドにないブロックを削除する関数
const removeNonMatchingClassName = (
	blockObject,
	choiceFields,
	dispTaxonomies,
	terms,
	blockMap,
) => {
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

	const newBlockObject = { ...blockObject }; // 新しいオブジェクトを作成
	// classNameから"field_""term_"が付いているクラス名を抽出
	const fieldClasses = className
		.split(" ")
		.filter((cls) => cls.startsWith("field_") || cls.startsWith("term_"));

	// 抽出したクラス名から"field_""term_"を取り除く
	const fields = fieldClasses.map((cls) => cls.replace(/^(field_|term_)/, ""));
	// fieldsを一つずつ取り出して、choiceFieldsに含まれていない場合はblockObjectを削除

	for (const field of fields) {
		let containsField = false;
		for (const choiceField of choiceFields) {
			//フィールド名を含むblockMapのキー名を取得(グループ名を含めた検索)
			const foundKey = Object.keys(blockMap).find((key) => key.includes(field));
			if (choiceField.includes(field) && foundKey && blockMap[foundKey]) {
				//選択フィールドを含むブロック内のクラス名に選択フィールド名があり、blockMapにブロックの定義がある
				containsField = true;
				break;
			}
			//表示設定があるタクソノミー名、ターム名を取り出し
			const match = field.trim().match(/^(.*?)_(.*?)$/);

			if (match && dispTaxonomies.includes(match[1])) {
				//投稿に設定されたタームがある
				const termArray = terms[match[1]];
				if (termArray.some((item) => item.slug === match[2])) {
					containsField = true;
					break;
				}
			}
		}
		//blockObjectを削除
		if (!containsField) {
			//ブロックを返さない
			return null;
		}
	}

	// innerBlocksが存在する場合は、再帰的に探索
	if (newBlockObject.innerBlocks && newBlockObject.innerBlocks.length > 0) {
		newBlockObject.innerBlocks = newBlockObject.innerBlocks
			.map((innerBlock) =>
				removeNonMatchingClassName(
					innerBlock,
					choiceFields,
					dispTaxonomies,
					terms,
					blockMap,
				),
			)
			.filter((innerBlock) => innerBlock !== null);
	}
	return newBlockObject;
};

//カスタムフィールドを検索する関数
const searchFieldObjects = (obj, fieldKey) => {
	let result = null;

	for (const key in obj) {
		if (key === fieldKey) {
			result = obj[key];
			break;
		} else if (typeof obj[key] === "object") {
			const nestedResult = searchFieldObjects(obj[key], fieldKey);
			if (nestedResult !== null) {
				result = nestedResult;
				break;
			}
		}
	}

	return result;
};

//コピーした属性にブロックエディタ上の投稿内容を維持してマージする関数
const mergeBlocks = (fieldArray, termArray, changeBlock) => {
	if (!changeBlock) return null;

	const { blockName, attributes, innerBlocks } = changeBlock;
	// attributesをprocessedAttributesにコピー
	const processedAttributes = { ...attributes };

	// className の確認とfield_以降の文字列の抽出
	const fieldClass =
		processedAttributes.className &&
		typeof processedAttributes.className === "string" &&
		processedAttributes.className
			.split(" ")
			.find((cls) => cls.startsWith("field_"));

	if (fieldClass) {
		const fieldName = fieldClass.replace(/^field_/, "");
		const fieldValue = fieldArray.find(
			(item) => item.fieldName === fieldName,
		).fieldValue;
		//フィールドのデータはコピー前のデータに書き戻す
		switch (blockName) {
			case "itmar/design-title":
				if (processedAttributes.className?.includes("itmar_link_block")) {
					processedAttributes.selectedPageUrl = fieldValue;
				} else {
					processedAttributes.headingContent = fieldValue;
				}

				break;
			case "core/paragraph":
				processedAttributes.content = fieldValue;
				break;
			case "core/image":
				if (fieldValue) {
					processedAttributes.id = fieldValue;
				}
			case "itmar/design-button":
				if (fieldValue) {
					processedAttributes.selectedPageUrl = fieldValue;
				}

				break;
			// 他のブロックタイプに対する処理をここに追加できます
		}
	}

	// className の確認とterm_以降の文字列の抽出
	const termClass =
		processedAttributes.className &&
		typeof processedAttributes.className === "string" &&
		processedAttributes.className
			.split(" ")
			.find((cls) => cls.startsWith("term_"));
	if (termClass) {
		//コピー先にコピー元のタームブロックと同じクラス名をもつブロックがあるか
		const isTermIncluded = termArray.some((term) =>
			termClass.includes(term.fieldName),
		);
		//ブロックがなければコピーしない
		if (!isTermIncluded) {
			return;
		}
	}

	// インナーブロックを再帰的に生成
	const newInnerBlocks = Array.isArray(innerBlocks)
		? innerBlocks
				.map((innerBlock) => mergeBlocks(fieldArray, termArray, innerBlock))
				.filter(Boolean)
		: [];
	// 新しいブロックを生成して返す
	return createBlock(blockName, processedAttributes, newInnerBlocks);
};

//階層化されたフィールドオブジェクトを.つなぎの文字列にする関数
const custumFieldsToString = (obj, prefix = "") => {
	return Object.entries(obj).flatMap(([key, value]) => {
		const fieldName = prefix ? `${prefix}.${key}` : key; //prefixはグループ名

		if (typeof value === "object" && value !== null) {
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
	const {
		replaceInnerBlocks,
		insertBlocks,
		removeBlocks,
		removeBlock,
		updateBlockAttributes,
	} = useDispatch("core/block-editor");
	//削除したブロックのclientIdの配列の参照
	const deletedClientIdsRef = useRef(new Set());
	//blocksAttributesArrayの参照
	const attArrayRef = useRef(null);

	//choiseTerms属性からクエリー用の配列を生成
	const getSelectedTaxonomyTerms = () => {
		const taxonomyTerms = choiceTerms.reduce((acc, { taxonomy, term }) => {
			if (acc.hasOwnProperty(taxonomy)) {
				acc[taxonomy] = `${acc[taxonomy]},${term.id}`;
			} else {
				acc[taxonomy] = term.id;
			}

			return acc;
		}, {});

		return {
			...taxonomyTerms,
			tax_relation: taxRelateType,
		};
	};

	//RestAPIでpostを取得する
	const fetchSearch = async (
		keyWord,
		taxonomyTerms,
		periodObj,
		choiceFields,
		searchFields,
	) => {
		const query = {
			search: keyWord,
			custom_fields: choiceFields,
			search_fields: searchFields,
			post_type: selectedSlug,
			per_page: pickupType === "multi" ? numberOfItems : 1,
			page: currentPage + 1,
			...taxonomyTerms,
			...periodObj,
			orderby: "date", // 日付順に並べる
			order: "desc", // 降順 (最新から古い順)
		};

		const queryString = new URLSearchParams(query).toString();

		try {
			const response = await fetch(
				`${post_blocks.home_url}/wp-json/itmar-rest-api/v1/search?${queryString}`,
			);
			const data = await response.json();

			console.log(data);

			setAttributes({ posts: data.posts, numberOfTotal: data.total });
			// データの処理
		} catch (error) {
			console.error("Failed to fetch posts:", error);
		}
	};

	const fetchPopular = async (choiceFields, taxonomyTerms) => {
		const query = {
			custom_fields: choiceFields,
			post_type: selectedSlug,
			per_page: numberOfItems,
			...taxonomyTerms,
			meta_key: "view_counter",
			orderby: "meta_value_num",
			order: "desc", // 降順 (アクセス数の多い順)
		};

		const queryString = new URLSearchParams(query).toString();

		try {
			const response = await fetch(
				`${post_blocks.home_url}/wp-json/itmar-rest-api/v1/search?${queryString}`,
			);
			const data = await response.json();

			console.log(data);

			setAttributes({ posts: data.posts, numberOfTotal: data.total });
			// データの処理
		} catch (error) {
			console.error("Failed to fetch posts:", error);
		}
	};

	//投稿データの取得処理
	useEffect(() => {
		//ポストタイプの指定がないときは処理しない
		if (selectedSlug) {
			if (pickupQuery === "nomal") {
				//RestAPIでpostを取得する
				fetchSearch(
					searchWord,
					getSelectedTaxonomyTerms(),
					getPeriodQuery(choicePeriod),
					choiceFields,
					searchFields,
				);
			}
		}
	}, [
		pickupType,
		numberOfItems,
		currentPage,
		selectedSlug,
		choiceTerms,
		taxRelateType,
		choicePeriod,
		searchWord,
		choiceFields,
		searchFields,
	]);

	//人気投稿の取得処理
	useEffect(() => {
		//ポストタイプの指定がないときは処理しない
		if (selectedSlug) {
			if (pickupQuery === "popular") {
				fetchPopular(choiceFields, getSelectedTaxonomyTerms());
			}
		}
	}, [numberOfItems, selectedSlug, choiceFields, choiceTerms]);

	useEffect(() => {
		//ポストタイプの指定がないときは処理しない
		if (selectedRest) {
			//ポストタイプによってblockMapに書き込まれたカスタムフィールドの情報を更新
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
						...Object.entries(fetchFields[0].acf).reduce(
							(acc, [key, value]) => ({
								...acc,
								[`acf_${key}`]: value,
							}),
							{},
						),
					};
					//カスタムフィール情報を平坦化して_acf_changedとfootnotesを除外
					const customFielsArray = custumFieldsToString(customFieldsObj).filter(
						(field) =>
							field !== "meta__acf_changed" && field !== "meta_footnotes",
					);
					//プレフィックスを削除した配列
					const normalizedFieldsArray = customFielsArray.map((field) =>
						field.replace(/^(meta_|acf_)/, ""),
					);
					// カスタムフィールド情報にないものをフィルタリング
					// これらのキーは常に保持する
					const alwaysKeep = [
						"title",
						"date",
						"excerpt",
						"featured_media",
						"link",
					];
					const filteredBlockMap = Object.fromEntries(
						Object.entries(blockMap).filter(
							([key]) =>
								normalizedFieldsArray.includes(key) || alwaysKeep.includes(key),
						),
					);
					normalizedFieldsArray.forEach((field) => {
						if (!filteredBlockMap.hasOwnProperty(field)) {
							filteredBlockMap[field] = "itmar/design-title";
						}
					});
					//blockMapを書き換え
					const newBlockMap = { ...filteredBlockMap };
					setAttributes({ blockMap: newBlockMap });
					//choiceFieldsから登録されていないカスタムフィールドを除外
					const filterChoiceFields = choiceFields.filter(
						(field) =>
							customFielsArray.includes(field) || alwaysKeep.includes(field),
					);
					setAttributes({ choiceFields: filterChoiceFields });
				} catch (error) {
					console.error("Error fetching data:", error.message);
				}
			};
			fetchData();
		}
	}, [selectedRest]);

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
	const { innerBlocks, parentBlock } = useSelect(
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
			};
		},
		[clientId],
	);

	//投稿データの抽出および表示フィールド変更に基づく再レンダリング

	useEffect(() => {
		if (!posts || !Array.isArray(posts)) {
			return; //postsが返っていなければ処理しない。
		}
		//この副作用でattArrayRefの値を消す
		attArrayRef.current = null;

		//blocksAttributesArrayを複製する
		const dispAttributeArray = [...blocksAttributesArray];

		//postの数とdispAttributeArray の数を合わせる
		const blocksLength = dispAttributeArray.length;
		const postsLength = posts.length;

		if (blocksLength < postsLength) {
			// dispAttributeArrayの長さがpostsの長さより短い場合、{}を追加する
			const diff = postsLength - blocksLength;
			for (let i = 0; i < diff; i++) {
				dispAttributeArray.push({});
			}
		} else if (blocksLength > numberOfItems) {
			// dispAttributeArrayの長さがnumberOfItemsの長さより長い場合、余分な要素を削除する
			dispAttributeArray.splice(postsLength);
		}

		//postsが０のときは空のメッセージ表示ブロックを登録して終了
		if (posts.length == 0) {
			const emptyMessage = createBlock(
				"itmar/design-title",
				emptyMessageAttributes,
			);
			const emptyBlock = createBlock(
				"itmar/design-group",
				{ ...emptyGroupAttributes, className: "itmar_emptyGruop" },
				[emptyMessage],
			);
			replaceInnerBlocks(clientId, [emptyBlock], false);
			return;
		} else if (
			innerBlocks.length === 1 &&
			innerBlocks[0].attributes.className?.includes("itmar_emptyGruop")
		) {
			//空を示すメッセージブロックは削除
			removeBlock(innerBlocks[0].clientId);
		}

		//blocksAttributesArrayの数分のブロックを生成
		const blocksArray = [];
		let diffIdFlg = false;

		dispAttributeArray.forEach((dispAttribute, index) => {
			//投稿データ（posts）がひな型（dispAttribute）の数に満たないときは最後の投稿データで埋める
			//idはnullに書き換え
			const post =
				index < posts.length ? posts[index] : { ...posts[0], id: null };

			//dispAttributeが{}ならitmar/design-groupブロックを挿入
			if (Object.keys(dispAttribute).length === 0) {
				Object.assign(dispAttribute, {
					blockName: "itmar/design-group",
					attributes: {},
				});
			}
			//最上位のitmar/design-groupのblockNum属性にpost.idをセットする（ブロック属性と一致している場合は入れ替えずフラグを立てる）
			if (dispAttribute.attributes.blockNum != post?.id) {
				dispAttribute.attributes.blockNum = post?.id;
				diffIdFlg = true;
			} else {
				diffIdFlg = false; //post.idの変更がないことを示すフラグ
			}

			//dispAttribute.attributes.blockNum = post.id;
			//追加するブロック
			const addBlocks = [];

			//グループのリンク解除処理
			if (!choiceFields.includes("link")) {
				updateBlockAttributes(dispAttribute.blockId, {
					is_link: false,
					selectedPageUrl: "",
				});
			}

			//すでにブロックの属性にフィールドのブロックが登録されているかを検査
			for (const fieldItem of choiceFields) {
				//カスタムフィールドの接頭辞をはずす
				const field = fieldItem.replace(/^(meta_|acf_)/, "");
				const blockname = blockMap[field];
				if (!blockname) {
					//フィールドのチェックはあるが対応するブロックの登録がない
					if (field === "link") {
						updateBlockAttributes(dispAttribute.blockId, {
							is_link: true,
							selectedPageUrl: post.link ? post.link : "",
						});
					}
					continue; //以下のフィールド処理は実行しない
				} else {
					//ブロックがあればグループのリンクは消す
					if (field === "link") {
						updateBlockAttributes(dispAttribute.blockId, {
							is_link: false,
							selectedPageUrl: "",
						});
					}
				}
				//グループ名をフィールドから外す
				const element_field = field.includes(".")
					? field.substring(field.lastIndexOf(".") + 1)
					: field;

				if (post) {
					//element_field値に応じた属性の初期値を生成

					let blockAttributes =
						element_field === "title"
							? {
									className: "field_title",
									headingContent: post.title.rendered
										? post.title.rendered
										: __("No title", "post-blocks"),
							  }
							: element_field === "date"
							? {
									className: "field_date",
									headingContent: post.date,
							  }
							: //メディアライブラリのIDが設定されていない場合
							element_field === "featured_media" && post.featured_media == 0
							? {
									className: "itmar_ex_block field_featured_media",
									url: `${post_blocks.plugin_url}/assets/no-image.png`,
									id: null,
							  }
							: //メディアライブラリのIDが設定されている場合
							element_field === "featured_media" && post.featured_media != 0
							? {
									className: "itmar_ex_block field_featured_media",
									id: post.featured_media,
									url: null,
							  }
							: element_field === "excerpt"
							? {
									className: "itmar_ex_block field_excerpt",
									content: post.excerpt.rendered
										? post.excerpt.rendered.replace(/<\/?p>/g, "") //pタグを除去する
										: __("No excerpt", "post-blocks"),
							  }
							: element_field === "link"
							? {
									className: "itmar_link_block field_link",
									linkKind: "free",
									selectedPageUrl: post.link ? post.link : "",
							  }
							: null;

					//カスタムフィールドの場合
					if (!blockAttributes) {
						//カスタムフィールドの値取得
						const costumFieldValue = searchFieldObjects(
							{ ...post.acf, ...post.meta },
							element_field,
						);

						switch (blockname) {
							case "itmar/design-title":
								const setValue =
									typeof costumFieldValue === "number"
										? costumFieldValue.toString()
										: costumFieldValue;
								blockAttributes = {
									className: `field_${element_field}`,
									headingContent: setValue,
								};

								break;
							case "core/paragraph":
								blockAttributes = {
									className: `itmar_ex_block field_${element_field}`,
									content: costumFieldValue,
								};
								break;
							case "core/image":
								//メディアライブラリのIDが設定されている場合とそうでない場合でノーイメージの画像を表示
								const setSource = costumFieldValue
									? { id: costumFieldValue, url: null }
									: {
											id: null,
											url: `${post_blocks.plugin_url}/assets/no-image.png`,
									  };

								blockAttributes = {
									className: `itmar_ex_block field_${element_field}`,
									...setSource,
								};
								break;
							default:
								blockAttributes = {
									className: `field_${element_field}`,
									headingContent: costumFieldValue,
								};
						}
					}

					//innerBlocksAttributesに指定されたフィールド用ブロックが存在するか。存在したら属性を上書き
					const is_field = hasMatchingClassName(
						dispAttribute,
						element_field,
						blockMap[field],
						blockAttributes,
						diffIdFlg,
					);

					if (!is_field) {
						//登録されていなければinnerBlocksAttributesにフィールド用ブロックを追加
						const blockname = blockMap[field] || "itmar/design-title";
						addBlocks.push({
							blockName: blockname,
							attributes: blockAttributes,
						});
					}
				}
			}
			//すでにタームのブロックが登録されているかを検査
			if (post?.terms) {
				const taxonomyData = post.terms;
				dispTaxonomies.forEach((taxonomy) => {
					if (taxonomyData[taxonomy]) {
						// タクソノミーが taxonomyData に存在するかチェック
						taxonomyData[taxonomy].forEach((term) => {
							const blockAttributes = {
								className: `term_${taxonomy}_${term.slug}`,
								headingContent: term.name,
							};
							//innerBlocksAttributesに指定されたフィールド用ブロックが存在するか。存在したら属性を上書き
							const is_field = hasMatchingClassName(
								dispAttribute,
								`${taxonomy}_${term.slug}`,
								"itmar/design-title",
								blockAttributes,
								false,
							);

							if (!is_field) {
								//登録されていなければinnerBlocksAttributesにフィールド用ブロックを追加
								addBlocks.push({
									blockName: "itmar/design-title",
									attributes: blockAttributes,
								});
							}
						});
					}
				});
			}

			//追加すべきフィールド表示用ブロックがあれば追加
			const addBlockobject = {
				...dispAttribute,
				innerBlocks: dispAttribute.innerBlocks
					? [...dispAttribute.innerBlocks]
					: [],
			}; //クローンを作成

			if (addBlocks.length > 0) {
				if (!addBlockobject.innerBlocks) {
					// addBlockobjectにinnerBlocksキーが存在しない場合は新しく追加
					Object.assign(addBlockobject, {
						innerBlocks: addBlocks,
					});
				} else {
					// addBlockobjectにinnerBlocksキーが存在する場合は既存の配列に追加
					addBlockobject.innerBlocks.push(...addBlocks);
				}
			}
			//選択されていないフィールドのブロックがあれば削除

			const filteredBlockObject = removeNonMatchingClassName(
				addBlockobject,
				choiceFields,
				dispTaxonomies,
				post?.terms,
				blockMap,
			);

			//filteredBlockObjectからreplaceInnerBlocks用のブロックオブジェクトを生成し、インナーブロックをレンダリング
			const blocksObj = createBlocksFromObject(filteredBlockObject); //Promiseで返ってくる

			//インナーブロックを配列にpush
			blocksArray.push(blocksObj);
		});

		// すべてのPromiseが解決された後に処理
		Promise.all(blocksArray)
			.then((resolvedBlocks) => {
				//インナーブロックの入れ替え;
				if (parentBlock?.name === "itmar/slide-mv") {
					//親ブロックがitmar/slide-mvのときは、ピックアップしたユニットを親ブロックのインナーブロックとして挿入
					const blockIdsToRemove = parentBlock.innerBlocks
						?.filter((block) => block.name === "itmar/design-group")
						.map((block) => block.clientId)
						.filter((id) => !deletedClientIdsRef.current.has(id)); // 一度削除されたclientIdは除外;

					//ユニットのitmar/design-groupを削除
					if (blockIdsToRemove && blockIdsToRemove.length > 0) {
						// removeBlocks実行
						removeBlocks(blockIdsToRemove);
						//新しいユニットの挿入
						insertBlocks(resolvedBlocks, 0, parentBlock.clientId, false);
						// 削除されたclientIdをセットに追加して記録
						blockIdsToRemove.forEach((id) =>
							deletedClientIdsRef.current.add(id),
						);
					}
				} else {
					//元のブロックと入れ替え
					replaceInnerBlocks(clientId, resolvedBlocks, false);
				}
				//貼付け中フラグをオフ
				setIsPastWait(false);
				setNoticeClickedIndex(null); //保持を解除
				//ペースト対象配列の初期化
				setIsCopyChecked(Array(blocksAttributesArray.length).fill(false));
			})
			.catch((error) => {
				//貼付け中フラグをオフ
				setIsPastWait(false);
				setNoticeClickedIndex(null); //保持を解除
				//ペースト対象配列の初期化
				setIsCopyChecked(Array(blocksAttributesArray.length).fill(false));
				// エラーハンドリング
				console.error("ブロックの解決中にエラーが発生しました:", error);
			});
	}, [posts, choiceFields, dispTaxonomies, blockMap]);

	//ペースト対象のチェック配列
	const [isCopyChecked, setIsCopyChecked] = useState([]);
	//CheckBoxのイベントハンドラ
	const handleCheckboxChange = (index, newCheckedValue) => {
		const updatedIsChecked = [...isCopyChecked];
		updatedIsChecked[index] = newCheckedValue;
		setIsCopyChecked(updatedIsChecked);
	};

	//blocksAttributesArrayが更新された時の処理
	useEffect(() => {
		//スタイルがペーストされたときブロックの再レンダリングをトリガー
		if (noticeClickedIndex !== null) {
			//noticeClickedIndexがコピー元を保持している場合
			const newPosts = [...posts];
			//setPosts(newPosts);
			setAttributes({ posts: newPosts });
		}
	}, [blocksAttributesArray]);

	//投稿データ更新関数
	const saveToDatabase = () => {
		//itmar/slide-mvが親ブロックの場合は親ブロックのインナーブロックを対象にセット
		const targetBlocks =
			parentBlock?.name === "itmar/slide-mv"
				? parentBlock.innerBlocks?.filter(
						(block) => block.name === "itmar/design-group",
				  )
				: innerBlocks;
		targetBlocks.forEach((unitBlock) => {
			//ユニットごとにポストデータを記録
			const unitAttribute = getBlockAttributes(unitBlock);
			//blockNumがnullの時は処理しない
			if (unitAttribute.attributes.blockNum == null) return;

			//ブロックに記入された内容を取得
			const fieldObjs = FieldClassNameObj(unitAttribute, "field_");
			if (!fieldObjs || fieldObjs.length < 1) return; //入力フィールドがない場合は処理しない

			// カスタムフィールドとその他のフィールドを分離
			const metaFields = {};
			const acfFields = {};
			const regularFields = {};

			fieldObjs.forEach((fieldObj) => {
				//choiceField属性からカスタムフィールド情報付きのフィールド名を取得する
				const choiceField = choiceFields.find((field) =>
					field.includes(fieldObj.fieldName),
				);
				// カスタムフィールドとその他のフィールドをそれぞれ生成
				if (choiceField) {
					if (choiceField.startsWith("meta_")) {
						metaFields[choiceField.slice(5)] = fieldObj.fieldValue;
					} else if (choiceField.startsWith("acf_")) {
						const fieldName = choiceField.slice(4); // 'acf_' プレフィックスを削除
						const fieldParts = fieldName.split(".");
						const acfValue =
							fieldObj.fieldValue === "" ? null : fieldObj.fieldValue;
						const nestedObj = createNestedObject(fieldParts, acfValue);
						// 既存のacfオブジェクトとマージ
						mergeNestedObjects(acfFields, nestedObj);
					} else if (choiceField === "date") {
						regularFields["date"] = new Date(fieldObj.fieldValue).toISOString();
					} else {
						regularFields[choiceField] = fieldObj.fieldValue;
					}
				} else {
					regularFields[fieldObj.fieldName] = fieldObj.fieldValue;
				}
			});

			//RestAPIのエンドポイントを生成
			const path = `/wp/v2/${selectedRest}/${unitAttribute.attributes.blockNum}`;
			// リクエストオプション

			const options = {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					...regularFields,
					meta: metaFields,
					acf: acfFields,
				}),
			};

			//APIリクエストを送信
			apiFetch({ path: path, ...options })
				.then((response) => {
					console.log("投稿が更新されました", response);
				})
				.catch((error) => {
					console.error("投稿の更新に失敗しました", error);
				});
		});
	};

	//更新ボタンによる投稿データの更新
	const { isSavingPost, isAutosavingPost } = useSelect((select) => ({
		isSavingPost: select(editorStore).isSavingPost(),
		isAutosavingPost: select(editorStore).isAutosavingPost(),
	}));

	useEffect(() => {
		if (isSavingPost && !isAutosavingPost) {
			//手動保存時のみ保存する
			saveToDatabase();
		}
	}, [isSavingPost, isAutosavingPost]);

	//表示ページ変更による投稿データの更新とブロック属性の変更
	useEffect(() => {
		if (!posts || posts.length < 1) {
			return; //postsが返っていなければ処理しない。
		}

		if (innerBlocks.length > 0) {
			saveToDatabase();
		}
	}, [currentPage]);

	//ブロック属性の更新処理
	useEffect(() => {
		if (innerBlocks.length > 0 || parentBlock?.name === "itmar/slide-mv") {
			//インナーブロックが対象ブロックなしの表示の時はemptyGroupAttributesの更新処理を行う
			if (
				innerBlocks.length === 1 &&
				innerBlocks[0].attributes.className?.includes("itmar_emptyGruop")
			) {
				const titleBlock = innerBlocks[0].innerBlocks?.find(
					(block) => (block.name = "itmar/design-title"),
				);
				setAttributes({
					emptyMessageAttributes: titleBlock?.attributes,
					emptyGroupAttributes: innerBlocks[0].attributes,
				});
				return;
			}
			//ユニットの属性更新処理
			const blockAttrArray = [];
			//itmar/slide-mvが親ブロックの場合は親ブロックのインナーブロックを対象にセット
			const targetBlocks =
				parentBlock?.name === "itmar/slide-mv"
					? parentBlock.innerBlocks?.filter(
							(block) => block.name === "itmar/design-group",
					  )
					: innerBlocks;
			targetBlocks.forEach((unitBlock) => {
				const unitAttribute = getBlockAttributes(unitBlock);
				//ユニットを配列に詰めてインナーブロックを更新
				blockAttrArray.push(unitAttribute);
			});
			//インナーブロックが設定された表示数より少ないときはblocksAttributesArrayで埋める
			let index = blockAttrArray.length % blocksAttributesArray.length;
			//上限はnumberOfItemsとする（表示数に応じたひな型を確保）
			while (
				blockAttrArray.length < blocksAttributesArray.length &&
				blockAttrArray.length < numberOfItems
			) {
				blockAttrArray.push(blocksAttributesArray[index]);
				index = (index + 1) % blocksAttributesArray.length;
			}
			//既にattArrayRefにデータがセットされていれば
			if (!attArrayRef.current) {
				if (!_.isEqual(blockAttrArray, blocksAttributesArray)) {
					setAttributes({ blocksAttributesArray: blockAttrArray });
				}
			}
		}
	}, [innerBlocks, parentBlock?.innerBlocks]);

	//Noticeのインデックス保持
	const [noticeClickedIndex, setNoticeClickedIndex] = useState(null);
	//貼付け中のフラグ保持
	const [isPastWait, setIsPastWait] = useState(false);

	//レンダリング
	return (
		<>
			<InspectorControls group="settings">
				<PanelBody title={__("Content Settings", "post-blocks")}>
					<TextControl
						label={__("Pickup ID", "post-blocks")}
						value={pickupId}
						onChange={(value) => setAttributes({ pickupId: value })}
					/>
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

					<SelectControl
						label={__("Select Query Type", "post-blocks")}
						value={pickupQuery}
						options={[
							{ label: __("Nomal", "post-blocks"), value: "nomal" },
							{ label: __("Popular", "post-blocks"), value: "popular" },
						]}
						onChange={(changeOption) => {
							setAttributes({ pickupQuery: changeOption });
						}}
					/>

					<div className="itmar_select_row">
						<RadioControl
							label={__("Pickup Post Type", "post-blocks")}
							selected={pickupType}
							options={[
								{ label: __("Muluti Post", "post-blocks"), value: "multi" },
								{ label: __("Single Post", "post-blocks"), value: "single" },
							]}
							onChange={(changeOption) =>
								setAttributes({ pickupType: changeOption })
							}
						/>
					</div>

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
							dispTaxonomies={dispTaxonomies}
							onChange={(newChoiceTerms) => {
								setAttributes({ choiceTerms: newChoiceTerms });
							}}
							onSetDispTax={(newChoiceTerms) => {
								setAttributes({ dispTaxonomies: newChoiceTerms });
							}}
						/>
					</PanelBody>

					<PanelBody title={__("Choice Field", "post-blocks")}>
						<FieldChoiceControl
							type="field"
							selectedSlug={selectedRest}
							choiceItems={choiceFields}
							blockMap={blockMap}
							textDomain="post-blocks"
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
								label={__("Display Num", "post-blocks")}
								max={30}
								min={1}
								onChange={(val) => setAttributes({ numberOfItems: val })}
							/>
						</PanelRow>
					)}
				</PanelBody>
			</InspectorControls>
			<InspectorControls group="styles">
				<PanelBody title={__("Unit Style Copy&Past", "post-blocks")}>
					<div className="itmar_post_block_notice">
						{blocksAttributesArray.map((styleObj, index) => {
							const copyBtn = {
								label: __("Copy", "post-blocks"),
								onClick: () => {
									//CopyがクリックされたNoticeの順番を記録
									setNoticeClickedIndex(index);
								},
							};
							const pastBtn = {
								label: isPastWait ? (
									<img
										src={`${post_blocks.plugin_url}/assets/past-wait.gif`}
										alt={__("wait", "post-blocks")}
										style={{ width: "36px", height: "36px" }} // サイズ調整
									/>
								) : (
									__("Paste", "post-blocks")
								),
								onClick: () => {
									//貼付け中フラグをオン
									setIsPastWait(true);
									//await new Promise((resolve) => setTimeout(resolve, 0));

									//記録された順番の書式をコピー
									if (noticeClickedIndex !== null) {
										//blocksAttributesArrayのクローンを作成
										const updatedBlocksAttributes = [...blocksAttributesArray];
										//ペースト対象配列にチェックが入った順番のものにペースト
										isCopyChecked.forEach((checked, index) => {
											if (checked) {
												//フィールド表示用のブロックからフィールド名と値を取得
												const fieldArray = FieldClassNameObj(
													updatedBlocksAttributes[index],
													"field_",
												);
												//フィールド表示用のブロックからフィールド名と値を取得
												const termArray = FieldClassNameObj(
													updatedBlocksAttributes[index],
													"term_",
												);
												//新しいブロックのスタイル属性にブロックエディタ上のフィールドの値を戻す
												const mergedBlock = mergeBlocks(
													fieldArray,
													termArray,
													blocksAttributesArray[noticeClickedIndex],
												);

												const mergedAttributes =
													getBlockAttributes(mergedBlock);

												// 元のblockNumを確保
												const { blockNum: sourceNum } =
													blocksAttributesArray[index].attributes;
												//新しいブロックスタイルをルートの属性とそれ以外に分離
												const { attributes: changeAttributes, ...elseElement } =
													mergedAttributes;
												//ルートの属性からblockNumを分離
												const { blockNum: changeNum, ...elseAttributes } =
													changeAttributes;
												// 新しいオブジェクトを生成（元のblockNumを入れる）
												const newElement = {
													...elseElement,
													attributes: {
														blockNum: sourceNum,
														...elseAttributes,
													},
												};

												//配列の要素を入れ替える
												updatedBlocksAttributes[index] = newElement;
											}
										});

										//属性を変更
										setAttributes({
											blocksAttributesArray: updatedBlocksAttributes,
										});
										//変更後の参照を確保
										attArrayRef.current = updatedBlocksAttributes;
									}
								},
							};
							const actions =
								noticeClickedIndex === index ? [pastBtn] : [copyBtn];
							const checkInfo = __(
								"Check the unit to which you want to paste and press the Paste button.",
								"post-blocks",
							);
							const checkContent =
								noticeClickedIndex != index ? (
									<CheckboxControl
										label={__("Paste to", "post-blocks")}
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
										<p>{`Unit ${index + 1} Style`}</p>
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
