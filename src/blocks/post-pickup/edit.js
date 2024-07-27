import { useSelect, useDispatch } from "@wordpress/data";
import { store as editorStore } from "@wordpress/editor";

import { __ } from "@wordpress/i18n";

import {
	dateI18n, // 日付をフォーマットし、サイトのロケールに変換
	format, // 日付のフォーマット
} from "@wordpress/date";
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
	Notice,
	RangeControl,
	TextControl,
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
			if (source[key] instanceof Object && !Array.isArray(source[key])) {
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
	} else if (!attributes.id) {
		const { url, alt, ...newAttributes } = attributes;
		//urlとaltを抜く
		return createBlock(blockName, newAttributes, innerBlocksArray);
	} else {
		return createBlock(blockName, attributes, innerBlocksArray);
	}
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
		.filter((cls) => cls.startsWith("field_"));

	// 抽出したクラス名から"field_"を取り除く
	const classNames = fieldClasses.map((cls) => cls.replace("field_", ""));

	// クラス名が存在すればtrueをかえす
	for (const className of classNames) {
		if (field === className) {
			// 一致するクラス名が見つかった場合は、overrideAttributesで属性を上書き
			if (blockObject.blockName === blockName) {
				if (isChangeId) {
					//投稿IDが変化していればレンダリング内容を変更
					Object.assign(blockObject.attributes, overrideAttributes);
				}
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
const FieldClassNameObj = (blockObject) => {
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
		.filter((cls) => cls.startsWith("field_"));

	// 抽出したクラス名から"field_"を取り除く
	const classNames = fieldClasses.map((cls) => cls.replace("field_", ""));

	// innerBlocksが存在する場合は、再帰的に探索
	if (blockObject.innerBlocks && blockObject.innerBlocks.length > 0) {
		const innerClassNames = blockObject.innerBlocks.flatMap((innerBlock) =>
			FieldClassNameObj(innerBlock),
		);
		return [...classNames, ...innerClassNames];
	}
	// classNamesが空配列ではない場合、classNamesの最初の要素とblockObjectをペアにしたオブジェクトを要素とする配列を返す
	if (classNames.length > 0) {
		const fieldValue =
			blockObject.blockName === "itmar/design-title"
				? blockObject.attributes.headingContent
				: blockObject.blockName === "core/paragraph"
				? blockObject.attributes.content
				: blockObject.blockName === "core/image"
				? blockObject.attributes.id
				: "";

		//console.log(blockObject.attributes.content);
		return [{ fieldName: classNames[0], fieldValue: fieldValue }];
	}
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

	const newBlockObject = { ...blockObject }; // 新しいオブジェクトを作成

	// classNameから"field_"が付いているクラス名を抽出
	const fieldClasses = className
		.split(" ")
		.filter((cls) => cls.startsWith("field_"));

	// 抽出したクラス名から"field_"を取り除く
	const fields = fieldClasses.map((cls) => cls.replace("field_", ""));
	// fieldsを一つずつ取り出して、choiceFieldsに含まれていない場合はblockObjectを削除
	for (const field of fields) {
		let containsField = false;
		for (const choiceField of choiceFields) {
			if (choiceField.includes(field)) {
				containsField = true;
				break;
			}
		}

		if (!containsField) {
			return null;
		}
	}

	// innerBlocksが存在する場合は、再帰的に探索
	if (newBlockObject.innerBlocks && newBlockObject.innerBlocks.length > 0) {
		newBlockObject.innerBlocks = newBlockObject.innerBlocks
			.map((innerBlock) => removeNonMatchingClassName(innerBlock, choiceFields))
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
const mergeBlocks = (fieldArray, changeBlock) => {
	if (!changeBlock) return null;

	const { blockName, attributes, innerBlocks } = changeBlock;
	// attributes の処理
	const processedAttributes = { ...attributes };

	// className の確認とfield_以降の文字列の抽出
	const fieldClass =
		processedAttributes.className &&
		typeof processedAttributes.className === "string" &&
		processedAttributes.className
			.split(" ")
			.find((cls) => cls.startsWith("field_"));

	if (fieldClass) {
		const fieldName = fieldClass.split("field_")[1];
		const fieldValue = fieldArray.find(
			(item) => item.fieldName === fieldName,
		).fieldValue;

		switch (blockName) {
			case "itmar/design-title":
				processedAttributes.headingContent = fieldValue;
				break;
			case "core/paragraph":
				processedAttributes.content = fieldValue;
				break;
			case "core/image":
				processedAttributes.id = fieldValue;
				break;
			// 他のブロックタイプに対する処理をここに追加できます
		}
	}

	// インナーブロックを再帰的に生成
	const newInnerBlocks = Array.isArray(innerBlocks)
		? innerBlocks
				.map((innerBlock) => mergeBlocks(fieldArray, innerBlock))
				.filter(Boolean)
		: [];
	// 新しいブロックを生成して返す
	return createBlock(blockName, processedAttributes, newInnerBlocks);
};

export default function Edit({ attributes, setAttributes, clientId }) {
	const {
		pickupId,
		selectedSlug,
		selectedRest,
		choiceTerms,
		taxRelateType,
		choiceFields,
		choicePeriod,
		numberOfItems,
		numberOfTotal,
		currentPage,
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

	//choicePeriod属性からクエリー用の配列を生成
	const getPeriodQuery = (dateString) => {
		if (!dateString) {
			return null; //与えられた文字列が空ならnullをかえす
		}
		const parts = dateString.split("/");
		const year = parseInt(parts[0], 10);
		const month = parts.length > 1 ? parseInt(parts[1], 10) : null;
		const day = parts.length > 2 ? parseInt(parts[2], 10) : null;

		let startDate, endDate;

		if (day) {
			// 特定の日
			startDate = new Date(year, month - 1, day, 0, 0, 0, -1);
			endDate = new Date(year, month - 1, day, 23, 59, 59, 1000);
		} else if (month) {
			// 特定の月
			startDate = new Date(year, month - 1, 1, 0, 0, 0, -1);
			endDate = new Date(year, month, 1, 0, 0, 0, 0);
		} else {
			// 特定の年
			startDate = new Date(year, 0, 1, 0, 0, 0, -1);
			endDate = new Date(year + 1, 0, 1, 0, 0, 0, 0);
		}

		return {
			after: startDate.toISOString(),
			before: endDate.toISOString(),
		};
	};

	//RestAPIでpostを取得する
	const [posts, setPosts] = useState([]);

	useEffect(() => {
		const fetchPosts = async () => {
			try {
				const taxonomyTerms = getSelectedTaxonomyTerms();
				const periodObj = getPeriodQuery(choicePeriod);
				console.log(periodObj);
				const query = {
					per_page: numberOfItems,
					page: currentPage + 1,
					_embed: true,
					...taxonomyTerms,
					...periodObj,
				};
				const totalQuery = {
					...taxonomyTerms,
					...periodObj,
					per_page: -1,
				};

				const queryString = Object.entries(query)
					.map(([key, value]) => `${key}=${value}`)
					.join("&");
				const totalString = Object.entries(totalQuery)
					.map(([key, value]) => `${key}=${value}`)
					.join("&");

				const postsResponse = await apiFetch({
					path: `/wp/v2/${selectedRest}?${queryString}`,
				});

				const totalPostsResponse = await apiFetch({
					path: `/wp/v2/${selectedRest}?${totalString}`,
				});

				setPosts(postsResponse);
				setAttributes({ numberOfTotal: totalPostsResponse.length });
			} catch (error) {
				console.log(error);
			}
		};

		fetchPosts();
	}, [
		numberOfItems,
		currentPage,
		selectedSlug,
		choiceTerms,
		taxRelateType,
		choicePeriod,
	]);

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
		if (!posts || !Array.isArray(posts)) {
			return; //postsが返っていなければ処理しない。
		}

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
		} else if (blocksLength > postsLength) {
			// dispAttributeArrayの長さがpostsの長さより長い場合、余分な要素を削除する
			dispAttributeArray.splice(postsLength);
		}
		//postsが０のときは空のグループを登録して終了
		if (dispAttributeArray.length == 0) {
			const emptyBlock = createBlock("itmar/design-group", {}, []);
			replaceInnerBlocks(clientId, emptyBlock, false);
			return;
		}
		//postの数分のデータを生成
		const blocksArray = [];
		let diffIdFlg = false;
		posts.forEach((post, index) => {
			//dispAttributeArray[index]が{}ならitmar/design-groupブロックを挿入
			if (Object.keys(dispAttributeArray[index]).length === 0) {
				Object.assign(dispAttributeArray[index], {
					blockName: "itmar/design-group",
					attributes: {},
				});
			}
			//最上位のitmar/design-groupのblockNum属性にpost.idをセットする（ブロック属性と一致している場合は入れ替えずフラグを立てる）
			if (dispAttributeArray[index].attributes.blockNum != post.id) {
				dispAttributeArray[index].attributes.blockNum = post.id;
				diffIdFlg = true;
			} else {
				diffIdFlg = false; //post.idの変更がないことを示すフラグ
			}

			dispAttributeArray[index].attributes.blockNum = post.id;

			//追加するブロック
			const addBlocks = [];

			//すでにブロックの属性にフィールドのブロックが登録されているかを検査
			for (const fieldItem of choiceFields) {
				//カスタムフィールドの接頭辞をはずす
				const field = fieldItem.replace(/^(meta_|acf_)/, "");
				//グループ名をフィールドから外す
				const element_field = field.includes(".")
					? field.substring(field.lastIndexOf(".") + 1)
					: field;

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
								headingContent: format("Y.n.j", post.date),
						  }
						: element_field === "featured_media"
						? {
								className: "itmar_ex_block field_featured_media",
								id: post._embedded["wp:featuredmedia"][0].id,
						  }
						: element_field === "excerpt"
						? {
								className: "itmar_ex_block field_excerpt",
								content: post.excerpt.rendered
									? post.excerpt.rendered.replace(/<\/?p>/g, "") //pタグを除去する
									: __("No excerpt", "post-blocks"),
						  }
						: null;
				//カスタムフィールドの場合
				if (!blockAttributes) {
					//カスタムフィールドの値取得
					const costumFieldValue = searchFieldObjects(
						{ ...post.acf, ...post.meta },
						element_field,
					);

					const blockname = blockMap[field];

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
							blockAttributes = {
								className: `itmar_ex_block field_${element_field}`,
								id: costumFieldValue,
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
					dispAttributeArray[index],
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

			//追加すべきフィールド表示用ブロックがあれば追加

			const addBlockobject = {
				...dispAttributeArray[index],
				innerBlocks: dispAttributeArray[index].innerBlocks
					? [...dispAttributeArray[index].innerBlocks]
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
				if (!_.isEqual(resolvedBlocks, dispAttributeArray)) {
					replaceInnerBlocks(clientId, resolvedBlocks, false);
				}
			})
			.catch((error) => {
				// エラーハンドリング
				console.error("ブロックの解決中にエラーが発生しました:", error);
			});
	}, [posts, choiceFields, blockMap]);

	//スタイルがペーストされたときブロックの再レンダリングをトリガー
	useEffect(() => {
		if (noticeClickedIndex !== null) {
			//noticeClickedIndexがコピー元を保持している場合
			setNoticeClickedIndex(null); //保持を解除
			const newPosts = [...posts];
			setPosts(newPosts);
		}
	}, [blocksAttributesArray]); //blocksAttributesArrayが更新された

	//投稿データ更新関数
	const saveToDatabase = () => {
		innerBlocks.forEach((unitBlock) => {
			//ユニットごとにポストデータを記録
			const unitAttribute = getBlockAttributes(unitBlock);
			//ブロックに記入された内容を取得
			const fieldObjs = FieldClassNameObj(unitAttribute);
			if (!fieldObjs) return; //入力フィールドがない場合は処理しない

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
			//console.log(options);
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
			// 保存処理
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
		if (innerBlocks.length > 0) {
			const blockAttrArray = [];
			innerBlocks.forEach((unitBlock) => {
				const unitAttribute = getBlockAttributes(unitBlock);
				//ユニットを配列に詰めてインナーブロックを更新
				blockAttrArray.push(unitAttribute);
			});
			//インナーブロックが設定された表示数より少ないときはblocksAttributesArrayで埋める
			let index = blockAttrArray.length % blocksAttributesArray.length;
			while (blockAttrArray.length < blocksAttributesArray.length) {
				blockAttrArray.push(blocksAttributesArray[index]);
				index = (index + 1) % blocksAttributesArray.length;
			}

			if (!_.isEqual(blockAttrArray, blocksAttributesArray)) {
				setAttributes({ blocksAttributesArray: blockAttrArray });
			}
		}
	}, [innerBlocks]);

	//Noticeのインデックス保持
	const [noticeClickedIndex, setNoticeClickedIndex] = useState(null);

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
							blockMap={blockMap}
							textDomain="post-blocks"
							onChange={(newChoiceFields) => {
								//選択されたフィールド名の配列を登録
								setAttributes({ choiceFields: newChoiceFields });
								// プレフィックスを除去した新しい配列を作成
								const processedFields = newChoiceFields.map((field) =>
									field.replace(/^(meta_|acf_)/, ""),
								);

								// 選択されたフィールド名に基づく新しいblockMapオブジェクトを生成
								processedFields.forEach((field) => {
									if (!blockMap.hasOwnProperty(field)) {
										blockMap[field] = "itmar/design-title";
									}
								});
								const newBlockMap = { ...blockMap };
								setAttributes({ blockMap: newBlockMap });
							}}
							onBlockMapChange={(newBlockMap) => {
								setAttributes({ blockMap: newBlockMap });
							}}
						/>
					</PanelBody>

					<PanelRow className="itmar_post_blocks_pannel">
						<RangeControl
							value={numberOfItems}
							label={__("Display Num", "block-collections")}
							max={30}
							min={1}
							onChange={(val) => setAttributes({ numberOfItems: val })}
						/>
					</PanelRow>
				</PanelBody>
			</InspectorControls>
			<InspectorControls group="styles">
				<PanelBody title={__("Unit Style Copy&Past", "post-blocks")}>
					<div className="itmar_post_block_notice">
						{blocksAttributesArray.map((styleObj, index) => {
							const actions = [
								{
									label: __("Copy", "post-blocks"),
									onClick: () => {
										//CopyがクリックされたNoticeの順番を記録
										setNoticeClickedIndex(index);
									},
								},
								{
									label: __("Paste", "post-blocks"),
									onClick: () => {
										//記録された順番の書式をコピー
										if (noticeClickedIndex !== null) {
											const updatedBlocksAttributes = [
												...blocksAttributesArray,
											];
											//フィールド表示用のブロックからフィールド名と値を取得
											const fieldArray = FieldClassNameObj(
												updatedBlocksAttributes[index],
											);
											//新しいブロックのスタイル属性にブロックエディタ上のフィールドの値を戻す
											const mergedBlock = mergeBlocks(
												fieldArray,
												blocksAttributesArray[noticeClickedIndex],
											);
											const mergedAttributes = getBlockAttributes(mergedBlock);

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
												attributes: { blockNum: sourceNum, ...elseAttributes },
											};

											//配列の要素を入れ替える
											updatedBlocksAttributes[index] = newElement;
											//属性を変更
											setAttributes({
												blocksAttributesArray: updatedBlocksAttributes,
											});
										}
									},
								},
							];
							return (
								<Notice
									key={index}
									actions={actions}
									status={noticeClickedIndex === index ? "success" : "default"}
									isDismissible={false}
								>
									<p>{`Unit ${index + 1} Style`}</p>
								</Notice>
							);
						})}
					</div>
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
