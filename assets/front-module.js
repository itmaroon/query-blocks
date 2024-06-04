import apiFetch from "@wordpress/api-fetch";
import {
	dateI18n, // 日付をフォーマットし、サイトのロケールに変換
	format, // 日付のフォーマット
} from "@wordpress/date";

//RestAPIで投稿データを取得する関数（Promiseを返す）
const getEntityRecordsFromAPI = (entity, query) => {
	const path = `/wp/v2/${entity}`;
	const queryString = Object.entries(query)
		.map(([key, value]) => `${key}=${value}`)
		.join("&");

	return apiFetch({ path: `${path}?${queryString}` });
};

//RestAPIでメディア情報を取得する関数（Promiseを返す）
const getMediaInfoFromAPI = (mediaId) => {
	const path = `/wp/v2/media/${mediaId}`;
	return apiFetch({ path: path });
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

const ModifyFieldElement = (element, post) => {
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
			const fieldValue = post[fieldName];
			//フィールドの種類によって書き換え方が変わる
			switch (fieldName) {
				case "title":
					const hElement = element.querySelector("h1, h2, h3, h4, h5, h6");
					if (hElement) {
						// h要素内のdivを探す
						const divElement = hElement.querySelector("div");

						if (divElement) {
							// divのテキストノードを書き換える
							divElement.textContent = fieldValue.rendered;
						}
					}
					break;
				case "date":
					const dElement = element.querySelector("h1, h2, h3, h4, h5, h6");
					if (dElement) {
						// h要素内のdivを探す
						const divElement = dElement.querySelector("div");

						if (divElement) {
							// divのテキストノードを書き換える
							divElement.textContent = dateI18n("Y.n.j", fieldValue);
						}
					}
					break;
				case "excerpt":
					// pの内容を書き換える
					element.innerHTML = fieldValue.rendered;
					break;
				case "featured_media":
					const iElement = element.querySelector("img");
					if (iElement) {
						getMediaInfoFromAPI(fieldValue)
							.then((data) => {
								// imgのsrc属性を書き換える
								const mediaUrl = data.media_details.sizes.medium.source_url;
								iElement.src = mediaUrl;
							})
							.catch((error) => console.error(error));
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

				data.forEach((post, index) => {
					//非表示のクラスを外す
					postUnits.classList.remove("unit_hide");
					//レンダリング指定のあるフィールドの内容をpostの内容によって書き換え
					ModifyFieldElement(postDivs[index], post);
				});
			})
			.catch((error) => console.error(error));
	});
});
