import apiFetch from "@wordpress/api-fetch";
import { __ } from "@wordpress/i18n";
import {
	dateI18n, // 日付をフォーマットし、サイトのロケールに変換
	format, // 日付のフォーマット
} from "@wordpress/date";

import { StyleComp as StyleGroup } from "../../block-collections/src/blocks/design-group/StyleGroup";
import { StyleComp as StyleButton } from "../../block-collections/src/blocks/design-button/StyleButton";
import { createRoot } from "react-dom/client";
import { restTaxonomies } from "itmar-block-packages";

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
					const iElement = element.querySelector("img");
					// 現在のmediaIdを取得
					const currentMediaId = iElement.classList
						.toString()
						.match(/wp-image-(\d+)/)[1];

					if (iElement) {
						if (!fieldValue) {
							//mediaIDがセットされていなければノーイメージ画像を設定して終了
							iElement.classList.remove(`wp-image-${currentMediaId}`);
							iElement.classList.add("wp-image-000");
							iElement.removeAttribute("srcset");
							iElement.style.objectFit = "contain";
							iElement.src = `${post_blocks.plugin_url}/assets/no-image.png`;
							iElement.alt = __("There is no image set.", "post-blocks");
							break;
						}

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
								.catch((error) => {
									//画像が見つからない場合の処理
									if (error.data.status == 404) {
										iElement.classList.remove(`wp-image-${currentMediaId}`);
										iElement.classList.add("wp-image-000");
										iElement.removeAttribute("srcset");
										iElement.style.objectFit = "contain";
										iElement.src = `${post_blocks.plugin_url}/assets/no-image.png`;
										iElement.alt = __("There is no image set.", "post-blocks");
									}
								}),
						);
					}
					break;
			}
		}
	}
};

//ページネーションの処理
const pageChange = (pickup, currentPage) => {
	const pickupId = pickup.dataset.pickup_id;
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
		page: currentPage + 1,
		_embed: true,
		...selectTerms,
	})
		.then((data) => {
			const postUnits = pickup.querySelectorAll(".post_unit")[0];
			if (!postUnits) return; //post_unitクラスの要素がなければリターン

			const postDivs = postUnits.children;
			const divElements = Array.from(postDivs);
			divElements.forEach((divs, index) => {
				if (!data[index]) {
					divs.style.display = "none"; // 要素を非表示にする
				} else {
					//レンダリング指定のあるフィールドの内容をpostの内容によって書き換え
					ModifyFieldElement(divs, data[index], blockMap);
					divs.style.display = "block"; // 要素を再表示する
				}
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
	//ページネーションのレンダリング
	const pagenationRoot = document.getElementById(`page_${pickupId}`);

	if (pagenationRoot && pagenationRoot.dataset.group_attributes) {
		const pagention = createRoot(pagenationRoot); //ページネーションのルート要素

		//RestAPIで投稿の総数を取得
		getEntityRecordsFromAPI(selectedRest, {
			per_page: -1,
			...selectTerms,
		})
			.then((data) => {
				//トータルのページ数を算出
				const totalPages = Math.ceil(data.length / numberOfItems);

				//totalPagesが２ページ以上
				if (totalPages > 1) {
					//ダミーボタンフラグ
					let isDummy = false;
					//ページネーションボタンの生成
					const pagenationButtons = (count) => {
						//カレントページを軸にページ番号ボタンを生成
						let forwardNum =
							currentPage -
							(Math.ceil((pagenationRoot.dataset.disp_items - 2) / 2) - 1);
						let backNum =
							currentPage +
							(Math.ceil((pagenationRoot.dataset.disp_items - 2) / 2) - 1);
						if (pagenationRoot.dataset.disp_items % 2 == 0) {
							//偶数の時は後ろに幅を持たせる
							backNum++;
						}

						if (forwardNum <= 0) {
							//0ページより前ならbackNumに回す
							backNum += forwardNum * -1 + 1;
							forwardNum = 1;
						}
						if (backNum >= totalPages - 1) {
							//トータルページのページ数を超えたら超えた分をforwardNumに回す
							forwardNum -= backNum - totalPages + 2;
							backNum = totalPages - 2;
						}
						return [...Array(count).keys()].map((index) => {
							//最初と最後およびカレントページ番号の前後で表示数の範囲は番号ボタン
							if (
								index === 0 ||
								index === count - 1 ||
								(index >= forwardNum && index <= backNum)
							) {
								isDummy = false; //ダミーボタンフラグを下げる
								return (
									<StyleButton
										key={index}
										attributes={JSON.parse(
											pagenationRoot.dataset.num_attributes,
										)}
									>
										<button
											onClick={() => {
												pageChange(pickup, index);
											}}
											disabled={index == currentPage}
										>
											<div>{index + 1}</div>
										</button>
									</StyleButton>
								);
							} else {
								//それ以外はダミーボタン
								if (!isDummy) {
									//ダミーボタンは連続して表示させない
									isDummy = true;
									return (
										<StyleButton
											key={index}
											attributes={JSON.parse(
												pagenationRoot.dataset.dummy_attributes,
											)}
										>
											<button disabled={true}>
												<div>...</div>
											</button>
										</StyleButton>
									);
								}
							}
						});
					};

					pagention.render(
						<StyleGroup
							attributes={JSON.parse(pagenationRoot.dataset.group_attributes)}
						>
							<div class="wp-block-itmar-design-group">
								<div
									className={`group_contents ${
										pagenationRoot.dataset.is_anime ? "fadeTrigger" : ""
									}`}
									data-is_anime={pagenationRoot.dataset.is_anime}
									data-anime_prm={JSON.stringify(
										pagenationRoot.dataset.anime_prm,
									)}
								>
									{pagenationRoot.dataset.is_arrow && (
										<StyleButton
											attributes={JSON.parse(
												pagenationRoot.dataset.back_attributes,
											)}
										>
											<button
												onClick={() => {
													if (currentPage > 0) {
														currentPage--;
														pageChange(pickup, currentPage);
													}
												}}
											>
												<div></div>
											</button>
										</StyleButton>
									)}

									<React.Fragment>
										{pagenationButtons(totalPages)}
									</React.Fragment>

									{pagenationRoot.dataset.is_arrow && (
										<StyleButton
											attributes={JSON.parse(
												pagenationRoot.dataset.forward_attributes,
											)}
										>
											<button
												onClick={() => {
													if (currentPage < totalPages - 1) {
														currentPage++;
														pageChange(pickup, currentPage);
													}
												}}
											>
												<div></div>
											</button>
										</StyleButton>
									)}
								</div>
							</div>
						</StyleGroup>,
					);
				} else {
					//ページネーションを消去
					pagention.render(
						<StyleGroup
							attributes={JSON.parse(pagenationRoot.dataset.group_attributes)}
						/>,
					);
				}
			})
			.catch((error) => console.error(error));
	}
};

//documentの読み込み後に処理
document.addEventListener("DOMContentLoaded", () => {
	//PickUp Postの親要素を取得
	const pickupElement = document.querySelectorAll(
		".wp-block-itmar-pickup-posts",
	);

	//pickupに応じてページネーションの操作によるページを表示
	pickupElement.forEach((pickup) => {
		//１ページ目を表示
		pageChange(pickup, 0);
	});
	//フィルタ設定用のブロックを取得
	const filterContainer = document.querySelector(".wp-block-itmar-post-filter");
	const filterId = filterContainer?.dataset.selected_id; //フィルタブロックに設定されたピックアップブロックのID

	const pickup = Array.from(pickupElement).find(
		(element) => element.getAttribute("data-pickup_id") === filterId,
	); //フィルタ設定ブロックに対応するピックアップブロック
	const pickupSlug = pickup?.dataset.selected_slug; //picupブロックから投稿タイプのスラッグを取得

	if (filterContainer) {
		//データベース上のタクソノミーとタームの設定を確認
		restTaxonomies(pickupSlug)
			.then((response) => {
				const taxArray = response.map((res) => {
					return {
						value: res.slug,
						label: res.name,
						terms: res.terms,
					};
				});
				//インナーブロック内のチェックボックスを抽出
				const checkboxes = filterContainer.querySelectorAll(
					'.itmar_filter_checkbox input[type="checkbox"]',
				);
				// taxArrayからすべてのterm nameを抽出
				const allTermNames = taxArray.flatMap((tax) =>
					tax.terms.map((term) => term.slug),
				);

				// checkboxesを配列に変換し、各要素をチェック
				Array.from(checkboxes).forEach((checkbox) => {
					const checkboxName = checkbox.getAttribute("name");

					// checkboxのname属性がallTermNamesに含まれていない場合、要素を削除
					if (!allTermNames.includes(checkboxName)) {
						const filterCheckboxElement = checkbox.closest(
							".itmar_filter_checkbox",
						);
						if (filterCheckboxElement && filterCheckboxElement.parentElement) {
							filterCheckboxElement.parentElement.remove();
						}
					}
				});
				//post-filterブロック内のitmar_filter_checkboxのチェックボックスを監視するリスナー
				checkboxes.forEach((checkbox) => {
					checkbox.addEventListener("change", function () {
						const checkedArray = Array.from(checkboxes)
							.filter((checkbox) => checkbox.checked)
							.map((checkbox) => {
								//チェックボックスが含まれるグループからクラス名を抽出（それがタクソノミー）
								const parentGroup = checkbox.closest(
									".wp-block-itmar-design-group",
								);
								if (parentGroup) {
									const classes = Array.from(parentGroup.classList);
									const taxonomy = classes.find(
										//wp-block-itmar-design-groupでないクラス名
										(cls) => cls !== "wp-block-itmar-design-group",
									);
									if (taxonomy) {
										// taxArrayから一致する要素を探す
										const matchingTax = taxArray.find(
											(tax) => tax.value === taxonomy,
										);
										if (matchingTax) {
											// termsから一致するslugを持つ要素を探す
											const matchingTerm = matchingTax.terms.find(
												(term) => term.slug === checkbox.name, //input要素のname属性がタームのスラッグ
											);
											if (matchingTerm) {
												return {
													taxonomy: taxonomy,
													term: {
														id: matchingTerm.id,
														slug: matchingTerm.slug,
													},
												};
											}
										}
									}
								}
								return null;
							})
							.filter((item) => item !== null);
						//チェックされたタームを新しい選択項目としてデータセット
						pickup.dataset.choice_terms = JSON.stringify(checkedArray);

						pageChange(pickup, 0); //表示ページの変更
					});
				});
			})
			.catch((error) => {
				console.error("投稿の更新に失敗しました", error);
			});
	}
});
