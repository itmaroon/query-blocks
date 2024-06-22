import apiFetch from "@wordpress/api-fetch";
import {
	dateI18n, // 日付をフォーマットし、サイトのロケールに変換
	format, // 日付のフォーマット
} from "@wordpress/date";

// プロミスを格納する配列
const promises = [];

const getBlockMapValue = (blockMap, fieldName) => {
	//blockMapのキーが.で区切られている場合は、最後の.の後の文字列から
	for (const key in blockMap) {
		if (key.includes(".")) {
			const lastDotIndex = key.lastIndexOf(".");
			const keyFieldName = key.slice(lastDotIndex + 1);
			if (keyFieldName === fieldName) {
				return blockMap[key];
			}
		}
	}
	return blockMap[fieldName];
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

//RestAPIで投稿データを取得する関数（Promiseを返す）
const getEntityRecordsFromAPI = (entity, query) => {
	const path = `/wp/v2/${entity}`;
	const queryString = Object.entries(query)
		.map(([key, value]) => `${key}=${value}`)
		.join("&");

	return apiFetch({ path: `${path}?${queryString}` });
};

//RestAPIでメディア情報を取得する関数（Promiseを返す）
const getMediaInfoFromAPI = async (mediaId) => {
	const path = `/wp/v2/media/${mediaId}`;
	const mediaInfo = await apiFetch({ path });
	return mediaInfo;
};

const getSelectedTaxonomyTerms = (choiceTerms, taxRelateType) => {
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

const ModifyFieldElement = (element, post, blockMap) => {
	// newPostUnitのすべての子要素を取得
	const allElements = element.getElementsByTagName("*");

	// 各要素を反復処理
	for (let i = 0; i < allElements.length; i++) {
		const element = allElements[i];

		// 要素のクラス名を取得
		const classNames = element.className.split(" ");

		// field_を含むクラス名があるかチェック
		const hasFieldClass = classNames.some((className) =>
			className.startsWith("field_"),
		);

		if (hasFieldClass) {
			// field_を含むクラス名がある場合、そのクラス内のDOM要素を書き換える
			const fieldClassName = classNames.find((className) =>
				className.startsWith("field_"),
			);
			// field_を除いたクラス名を取得
			const fieldName = fieldClassName.replace("field_", "");
			// postオブジェクト内で、そのクラス名をキーとする値を取得

			//カスタムフィールドの値取得
			const costumFieldValue = searchFieldObjects(
				{ ...post.acf, ...post.meta },
				fieldName,
			);
			//ビルトインのフィールド名があればその値をとり、なければカスタムフィールドの値をとる
			const fieldValue = post[fieldName] || costumFieldValue;
			//フィールドとブロックの対応マップからブロック名を抽出
			const blockName = getBlockMapValue(blockMap, fieldName);
			//フィールドの種類によって書き換え方が変わる
			switch (blockName) {
				case "itmar/design-title":
					const hElement = element.querySelector("h1, h2, h3, h4, h5, h6");
					if (hElement) {
						// h要素内のdivを探す
						const divElement = hElement.querySelector("div");
						console.log(fieldValue);
						if (divElement) {
							// divのテキストノードを書き換える
							if (fieldName === "date") {
								divElement.textContent = dateI18n("Y.n.j", fieldValue);
							} else if (fieldName === "title") {
								divElement.textContent = fieldValue.rendered;
							} else {
								divElement.textContent = fieldValue;
							}
						}
					}
					break;

				case "core/paragraph":
					// pの内容を書き換える
					element.innerHTML = fieldValue.rendered;
					break;
				case "core/image":
					if (!fieldValue) break; //mediaIDがセットされていなければ終了
					const iElement = element.querySelector("img");
					if (iElement) {
						promises.push(
							getMediaInfoFromAPI(fieldValue)
								.then((data) => {
									// 必要なデータを抽出
									const newSrc = data.source_url;
									const newSrcset = Object.entries(data.media_details.sizes)
										.map(([name, size]) => `${size.source_url} ${size.width}w`)
										.join(", ");
									const newWidth = data.media_details.width;
									const newHeight = data.media_details.height;
									const newAlt = data.alt_text;
									// 現在のmediaIdを取得
									const currentMediaId = iElement.classList
										.toString()
										.match(/wp-image-(\d+)/)[1];

									// img要素の属性を更新
									iElement.src = newSrc;
									iElement.srcset = newSrcset;
									iElement.width = newWidth;
									iElement.height = newHeight;
									iElement.alt = newAlt;
									// クラス名を更新
									iElement.classList.remove(`wp-image-${currentMediaId}`);
									iElement.classList.add(`wp-image-${fieldValue}`);
								})
								.catch((error) => console.error(error)),
						);
					}
					break;
			}
		}
	}
};

document.addEventListener("DOMContentLoaded", () => {
	//PickUp Postの親要素を取得
	const pickupElement = document.querySelectorAll(
		".wp-block-itmar-pickup-posts",
	);

	//エディタで設定された属性をdatasetで受け取ってクエリーの結果を取得
	pickupElement.forEach((pickup) => {
		const numberOfItems = pickup.dataset.number_of_items;
		const selectedRest = pickup.dataset.selected_rest;
		const taxRelateType = pickup.dataset.tax_relate_type;
		const choiceTerms = JSON.parse(pickup.dataset.choice_terms);
		const blockMap = JSON.parse(pickup.dataset.block_map);
		//タームのセレクトオブジェクト
		const selectTerms = getSelectedTaxonomyTerms(choiceTerms, taxRelateType);
		//RestAPIで結果を取得
		getEntityRecordsFromAPI(selectedRest, {
			per_page: numberOfItems,
			...selectTerms,
		})
			.then((data) => {
				const postUnits = pickup.querySelectorAll(".post_unit")[0];
				if (!postUnits) return; //post_unitクラスの要素がなければリターン

				const postDivs = postUnits.children;
				const divElements = Array.from(postDivs);
				divElements.forEach((divs, index) => {
					//レンダリング指定のあるフィールドの内容をpostの内容によって書き換え
					ModifyFieldElement(divs, data[index], blockMap);
				});
				// すべてのプロミスが完了したら非表示のクラスを外す
				Promise.all(promises)
					.then(() => {
						const postUnits = document.querySelectorAll(".post_unit");
						postUnits.forEach((unit) => {
							//非表示のクラスを外す
							unit.classList.remove("unit_hide");
						});
					})
					.catch((error) => console.error(error));
			})
			.catch((error) => console.error(error));
	});
});
