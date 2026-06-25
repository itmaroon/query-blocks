import apiFetch from "@wordpress/api-fetch";
import { __ } from "@wordpress/i18n";
import { format, getSettings } from "@wordpress/date";

import { MasonryControl, slideBlockSwiperInit } from "itmar-block-packages";

//タームによるフィルタを格納する変数
let termQueryObj = []; //post-filterの入力値（ユーザー入力）
//エンコードしたURLパラメータを格納する変数
let termParamObj = null;

//期間のオブジェクトを格納する変数
let periodQueryObj = {};
let periodDisp = ""; //post-filterの入力値（ユーザー入力）
//キーワードを格納する変数
let searchKeyWord = "";
//URLパラメータを格納する変数
let setUrlParam = "";

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

//RestAPIで投稿データを取得する関数
const getSearchRecordsFromAPI = async (query) => {
	const queryString = new URLSearchParams(query).toString();

	try {
		const response = await fetch(
			`${itmar_option.home_url}/wp-json/itmar-rest-api/v1/search?${queryString}`,
		);
		const data = await response.json();

		return data;

		// データの処理
	} catch (error) {
		console.error("Failed to fetch posts:", error);
	}
};

//RestAPIでメディア情報を取得する関数
const getMediaInfoFromAPI = async (mediaId) => {
	const path = `/wp/v2/media/${mediaId}`;
	const mediaInfo = await apiFetch({ path });
	return mediaInfo;
};

// ACF の値から画像URLを取り出すユーティリティ
const extractImageUrlFromAcfValue = (value) => {
	if (!value) return null;

	// URL文字列そのもの
	if (typeof value === "string") {
		if (/^https?:\/\//.test(value)) return value;
		return null; // IDだけなどはここでは扱わない
	}

	// オブジェクト形式 { url: "..."} や { sizes: { large: "..." } }
	if (typeof value === "object") {
		if (value.url) return value.url;
		if (value.sizes?.large) return value.sizes.large;
		if (value.sizes?.full) return value.sizes.full;
	}

	return null;
};

// ネストパス（"option_img_group.option_1" など）でオブジェクトを辿る
const getNested = (obj, pathStr) => {
	if (!obj || !pathStr) return undefined;
	const keys = pathStr.split(".");
	let cur = obj;
	for (const key of keys) {
		if (cur == null) return undefined;
		cur = cur[key];
	}
	return cur;
};

const getSelectedTaxonomyTerms = (choiceTerms, taxRelateType) => {
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

//フロントエンドで取得した投稿データで書き換える関数
const ModifyFieldElement = async (
	element,
	post,
	taxTermObjects,
	blockMap,
	post_num,
) => {
	// 最上位要素がa要素の時はそのhref属性を書き換え
	if (element && element.tagName === "A") {
		element.setAttribute("href", post.link);
	}

	//静的コレクションで取得すること
	const allElements = element.querySelectorAll("*");

	// 各要素を反復処理
	for (let i = 0; i < allElements.length; i++) {
		const el = allElements[i];

		// 要素のクラス名を取得
		const classNames = el.className.split(" ");

		// field_を含むクラス名があるかチェック
		const hasFieldClass = classNames.some((className) =>
			className.startsWith("sp_field_"),
		);

		if (hasFieldClass) {
			// field_を含むクラス名がある場合、そのクラス内のDOM要素を書き換える
			const fieldClassName = classNames.find((className) =>
				className.startsWith("sp_field_"),
			);

			// field_を除いたクラス名を取得
			const fieldName = fieldClassName.replace("sp_field_", "");
			// postオブジェクト内で、そのクラス名をキーとする値を取得

			//カスタムフィールドの値取得
			const fieldNameWithoutPrefix = fieldName.replace(/^(acf_|meta_)/, "");
			const costumFieldValue = searchFieldObjects(
				{ ...post.acf, ...post.meta },
				fieldNameWithoutPrefix,
			);
			//ビルトインのフィールド名があればその値をとり、なければカスタムフィールドの値をとる
			const fieldValue = post[fieldName] || costumFieldValue;

			//フィールドとブロックの対応マップからブロック名を抽出
			const blockName = getBlockMapValue(blockMap, fieldName);

			//フィールドの種類によって書き換え方が変わる
			switch (blockName) {
				case "itmar/design-title":
					//クラス名にitmar_link_blockが含まれるときに処理
					if (classNames.includes("itmar_link_block")) {
						const aElement = el.querySelector("a");
						aElement.setAttribute("href", fieldValue);
					} else {
						//クラス名にitmar_link_blockが含まれないときに処理
						const hElement = el.querySelector("h1, h2, h3, h4, h5, h6");

						if (hElement) {
							// h要素内のdivを探す
							//const divElement = hElement.querySelector("div");

							//titleTypeを取り出す
							const titleType = el.getAttribute("data-title_type");

							// divのテキストノードを書き換える
							if (fieldName === "date") {
								//デザインタイトルのタイトルタイプがdateならフォーマットをあてる
								if (titleType === "date") {
									//date_formatを取り出す
									const dateFormat =
										el.getAttribute("data-user_format") || "%s";
									hElement.textContent = format(
										dateFormat,
										fieldValue,
										getSettings(),
									);
								} else {
									hElement.textContent = fieldValue;
								}
							} else if (fieldName === "title") {
								hElement.textContent = fieldValue.rendered;
							} else {
								hElement.textContent = fieldValue;
							}
						}
					}

					break;

				case "core/paragraph":
					// pの内容を書き換える
					if (fieldName === "excerpt") {
						el.innerHTML = fieldValue.rendered;
					} else {
						el.innerHTML = fieldValue;
					}

					break;
				case "core/image":
					const iElement = el.querySelector("img");
					// 現在のmediaIdを取得（イメージ要素にクラス名がある場合）
					const currentMediaId = iElement.classList
						.toString()
						.match(/wp-image-(\d+)/)
						? iElement.classList.toString().match(/wp-image-(\d+)/)[1]
						: undefined;

					if (iElement) {
						if (!fieldValue && !currentMediaId) {
							//mediaIDがセットされていなければノーイメージ画像を設定して終了
							iElement.classList.remove(`wp-image-${currentMediaId}`);
							iElement.classList.add("wp-image-000");
							iElement.removeAttribute("srcset");
							iElement.style.objectFit = "contain";
							iElement.src = `${itmar_option.plugin_url}/assets/no-image.png`;
							iElement.alt = __("There is no image set.", "query-blocks");
							break;
						}

						// img要素の属性を更新
						iElement.src = fieldValue.source_url;
						iElement.srcset = Object.entries(fieldValue.media_details.sizes)
							.map(([name, size]) => `${size.source_url} ${size.width}w`)
							.join(", ");
						iElement.width = fieldValue.media_details.width;
						iElement.height = fieldValue.media_details.height;
						iElement.alt = fieldValue.alt_text;
						// クラス名を更新
						iElement.classList.remove(`wp-image-${currentMediaId}`);
						iElement.classList.add(`wp-image-${fieldValue.id}`);
					}

					break;
				case "itmar/design-button":
					const buttonElement = el.querySelector("button");
					const valWithPrm = `${fieldValue}${setUrlParam}`;
					buttonElement.setAttribute("data-selected_page", valWithPrm);
					break;
				case "itmar/slide-mv":
					//swiper初期化
					// const swiperEl = reBuildSwiper(el, post_num, fieldValue);
					// if (swiperEl) {
					// 	slideBlockSwiperInit(swiperEl);
					// }
					jQuery(function ($) {
						const $el = $(el);

						//swiper独自ID
						const swiperId = `slide-${post_num}`;
						const clone_swiper = $el.find(".swiper");

						//IDの付け直し
						clone_swiper.removeData("swiper-id");
						clone_swiper.attr("data-swiper-id", swiperId);
						const classPrefixMap = {
							prev: "swiper-button-prev",
							next: "swiper-button-next",
							pagination: "swiper-pagination",
							scrollbar: "swiper-scrollbar",
						};

						Object.entries(classPrefixMap).forEach(([suffix, baseClass]) => {
							const $target = clone_swiper.parent().find(`.${baseClass}`);
							$target.each(function () {
								const currentClasses = $(this).attr("class").split(/\s+/);
								const filteredClasses = currentClasses.filter(
									(cls) => cls === baseClass,
								);
								// 新しい `${swiperId}-${suffix}` を追加
								filteredClasses.push(`${swiperId}-${suffix}`);
								$(this).attr("class", filteredClasses.join(" "));
							});
						});
						//swiper-wrapper内からswiper-slideを抽出
						const wrapper = clone_swiper.find(".swiper-wrapper");
						const templateSlide = wrapper.find(".swiper-slide").first();
						//swiper-wrapperオブジェクトをクリア
						clone_swiper.empty();
						// 新しい swiper-wrapper を作成
						const newWrapper = $('<div class="swiper-wrapper"></div>');
						// valueの件数にあわせて、ひな型を複製
						if (fieldValue) {
							fieldValue.forEach((imgNode) => {
								const newSlide = templateSlide.clone(true); // trueでイベントもコピー
								//img要素を取り出し画像を差し替え
								const $img = newSlide.find("img").first();
								if (imgNode.type === "image") {
									$img.attr("src", imgNode.url);
									$img.attr("alt", imgNode.alt || "");
									newWrapper.append(newSlide);
								}
							});
						}
						//新しいswiper-wrapperを追加
						clone_swiper.append(newWrapper);

						slideBlockSwiperInit(clone_swiper[0]);
					});
					break;
			}
		}

		// tax_を含むクラス名があるかチェック
		const hasTaxClass = classNames.some((className) =>
			className.startsWith("tax_"),
		);
		if (hasTaxClass) {
			//taxTermObjectsに値がわたっているか
			if (taxTermObjects.length > 0) {
				// tax_を含むクラス名がある場合、そのクラス内のDOM要素を書き換える
				const taxClassName = classNames.find((className) =>
					className.startsWith("tax_"),
				);
				// tax_を除いたクラス名を取得
				const taxName = taxClassName.replace("tax_", "");
				//親要素を取得
				const parent = el.parentElement;

				// taxTermObjectsで、taxonomy名をキーとする値を取得
				for (const obj of taxTermObjects) {
					const entries = Object.entries(obj);

					if (entries.length === 0) continue;

					const [tax, values] = entries[0];

					if (tax !== taxName) {
						// このオブジェクトのタクソノミーが taxName と違う場合はスキップ
						continue;
					}

					// values が 0 件なら、この DOM 要素を削除してスキップ
					if (!values || values.length === 0) {
						el.remove();
						continue;
					}
					// values が配列であることを想定（ターム名の配列）
					values.forEach((termName, index) => {
						// 1つ目のタームは元の el を使い、それ以降は複製して兄弟要素に追加
						const cloneTermElm = index === 0 ? el : el.cloneNode(true);

						// hタグ内の要素を書き換え
						const hTags = cloneTermElm.querySelectorAll(
							"h1, h2, h3, h4, h5, h6",
						);
						hTags.forEach((hTag) => {
							// h タグ内の <div> 要素を探す
							const divTag = hTag.querySelector("div");
							if (divTag) {
								// <div> のテキストノードを termName に書き換え
								divTag.textContent = termName;
							}
						});

						// 2個目以降は DOM に追加
						if (index > 0) {
							parent.appendChild(cloneTermElm);
						}
					});
				}
			}
		}
		//itmaroon-masonry-gridをクラス名として持つ要素を取得
		const hasMasonryClass = classNames.includes("wp-block-itmar-masonry-mv");

		if (hasMasonryClass) {
			// ★ この el がマソンリーのグリッド要素
			const gridEl = el.querySelector(".itmar-masonry-grid");
			let images = [];

			//レスポンシブのフラグ
			const isMobile =
				typeof mobile_flg !== "undefined"
					? mobile_flg
					: window.matchMedia("(max-width: 767px)").matches;

			if (gridEl?.getAttribute("data-source-type") === "dynamic") {
				//data-source-typeがdynamicのときだけ
				// 1) data-choice-fields を配列に戻す
				let choiceFields = [];
				const choiceAttr = gridEl.getAttribute("data-choice-fields");

				if (choiceAttr) {
					try {
						choiceFields = JSON.parse(choiceAttr); // ["content","featured_media","acf_gallery",...]
					} catch (e) {
						console.error("Failed to parse data-choice-fields:", e);
						choiceFields = [];
					}
				}

				// 2) choiceFields に従って post から画像URLを集める

				for (const field of choiceFields) {
					// 本文内の画像 (content)
					if (field === "content") {
						const html = post?.content?.rendered || post?.content || "";
						if (html) {
							const tmp = document.createElement("div");
							tmp.innerHTML = html;
							const imgs = tmp.querySelectorAll("img");
							imgs.forEach((img) => {
								if (img.src) {
									images.push({
										url: img.src,
										alt: img.alt || "",
										type: "content",
										field: "content",
									});
								}
							});
						}
					}
					// アイキャッチ画像 (featured_media)
					else if (field === "featured_media") {
						const url = post.featured_media.source_url;
						if (url) {
							images.push({
								url,
								alt: post.title?.rendered || post.title || "",
								type: "featured_media",
								field: "featured_media",
							});
						}
					}
					// ACF 系 (acf_***)
					else if (field.startsWith("acf_")) {
						// "acf_gallery" や "acf_option_img_group.option_1" など
						const acfPath = field.slice(4); // "acf_" 以降 → "gallery", "option_img_group.option_1" など
						const acfRoot = post.acf || {};
						const value = getNested(acfRoot, acfPath);

						if (!value) return;

						// gallery (配列) の場合
						if (Array.isArray(value)) {
							value.forEach((item) => {
								const url = extractImageUrlFromAcfValue(item);
								if (url) {
									images.push({
										url,
										alt: item?.alt || "",
										type: "acf_gallery",
										field,
									});
								}
							});
						} else {
							// 単一画像フィールド
							const media_info = await getMediaInfoFromAPI(value);
							if (media_info) {
								images.push({
									url: media_info.source_url,
									alt: media_info.alt_text || "",
									type: "acf_image",
									field,
								});
							}
						}
					}
				}

				//設定されたカラム数の取得
				const mobileColumns = gridEl.getAttribute("data-mobile-columns");
				const defaultColumns = gridEl.getAttribute("data-default-columns");

				const columns = isMobile
					? parseInt(mobileColumns || defaultColumns || "1", 10)
					: parseInt(defaultColumns || "1", 10);
				//マソンリーレイアウト初期化
				MasonryControl(gridEl, images, {
					columns,
					renderItems: true, // フロントではこの関数内で <figure> を描画
				});
			} else {
				images = isMobile
					? JSON.parse(gridEl.getAttribute("data-mobile-media"))
					: JSON.parse(gridEl.getAttribute("data-default-media"));
			}

			//swiperを検出して初期化
			const swiperEls = el.querySelectorAll(".swiper");
			let expand_masonry = null;
			if (swiperEls.length > 0) {
				// swiperEls は NodeList
				swiperEls.forEach((el) => {
					jQuery(function ($) {
						const clone_swiper = $(el);
						//swiper独自ID
						const swiperId = `slide-${post_num}`;

						//IDの付け直し
						clone_swiper.removeData("swiper-id");
						clone_swiper.attr("data-swiper-id", swiperId);
						const classPrefixMap = {
							prev: "swiper-button-prev",
							next: "swiper-button-next",
							pagination: "swiper-pagination",
							scrollbar: "swiper-scrollbar",
						};

						Object.entries(classPrefixMap).forEach(([suffix, baseClass]) => {
							const $target = clone_swiper.parent().find(`.${baseClass}`);
							$target.each(function () {
								const currentClasses = $(this).attr("class").split(/\s+/);
								const filteredClasses = currentClasses.filter(
									(cls) => cls === baseClass,
								);
								// 新しい `${swiperId}-${suffix}` を追加
								filteredClasses.push(`${swiperId}-${suffix}`);
								$(this).attr("class", filteredClasses.join(" "));
							});
						});
						//swiper-wrapper内からswiper-slideを抽出
						const wrapper = clone_swiper.find(".swiper-wrapper");
						const templateSlide = wrapper.find(".swiper-slide").first();
						//swiper-wrapperオブジェクトをクリア
						clone_swiper.empty();
						// 新しい swiper-wrapper を作成
						const newWrapper = $('<div class="swiper-wrapper"></div>');

						// valueの件数にあわせて、ひな型を複製
						if (images) {
							images.forEach((imgNode) => {
								const newSlide = templateSlide.clone(true); // trueでイベントもコピー
								//img要素を取り出し画像を差し替え
								const $img = newSlide.find("img").first();
								$img.attr("src", imgNode.url);
								$img.attr("alt", imgNode.alt || "");
								$img.removeAttr("srcset").removeAttr("sizes");
								newWrapper.append(newSlide);
							});
						}

						//新しいswiper-wrapperを追加
						clone_swiper.append(newWrapper);

						expand_masonry = slideBlockSwiperInit(clone_swiper[0]);
					});
				});
			}
			//masonry画像のクリックイベント
			jQuery(function ($) {
				$(gridEl).on("click", ".itmar-masonry-link", function (e) {
					e.preventDefault();
					const $link = $(this);
					const index = parseInt($link.data("masonry-index") || 0, 10);

					expand_masonry.instance.slideTo(index);

					expand_masonry.instance.update();
					const $blockRoot = $(this).closest(".wp-block-itmar-masonry-mv");
					$blockRoot.find(".itmar-masonry-inner-blocks").children().show();
				});
			});
		}
	}
};

//クローン生成の関数
const buildClone = (selected) => {
	const $clone = jQuery(selected).clone();
	$clone
		.find(
			".hide-wrapper > .wp-block-itmar-design-title, .wp-block-itmar-design-button, .itmar_ex_block, .itmar_ex_block_wrapper",
		)
		.each(function () {
			const $el = jQuery(this);
			$el.css("visibility", "visible");
			if ($el.parent().hasClass("hide-wrapper")) $el.unwrap();
		});

	return $clone[0];
};

//テンプレートにコンテンツを流し込む関数
const replaceContent = async (
	pickpData,
	target_block,
	block_map,
	fillFlg,
	pickupType,
	dispTaxonomies,
) => {
	//通常のpickup
	if (!fillFlg) {
		const template = target_block.querySelector(".template_unit");

		if (!template) return; // 念のため防御

		// ② .template_unit の「子要素」を配列にする
		const target_array = Array.from(template.children);

		//pickupDataの内容によってレンダリングされたDOM要素からデザインの要素を選択
		for (const [i, pickup] of pickpData.entries()) {
			const featuredMedia = pickup.featured_media;
			let aspectRatio = 1.2;
			if (featuredMedia) {
				const mediaInfo = await getMediaInfoFromAPI(featuredMedia);
				if (mediaInfo) {
					pickup.featured_media = mediaInfo;
					aspectRatio =
						mediaInfo.media_details.width / mediaInfo.media_details.height;
				}
			}
			// ③ 配列から1つ選別（selectTemplateUnit が要素を返す想定）

			const selected =
				pickupType === "single"
					? target_array[0]
					: selectTemplateUnit(target_array, aspectRatio, i + 1);

			if (!selected) return;

			// ④ 選ばれた要素をクローンして target_block に挿入
			let clone = buildClone(selected);

			//投稿に紐づいたターム情報を取得
			const taxTermObjects = [];
			const def_tax_map = {
				category: "categories",
				post_tag: "tags",
				// 例: カスタムタクソノミー 'product_cat' が REST で /wp/v2/product_cat ならそのまま
			};
			for (const tax of dispTaxonomies) {
				const endpoint = def_tax_map[tax] ?? tax;
				const term_info = await apiFetch({
					path: `/wp/v2/${endpoint}?post=${pickup.id}`,
				});

				// ターム名だけの配列を作成
				const termNames = term_info.map((term) => term.name);

				// タクソノミー名をキー、値をターム名配列とするオブジェクトを作成
				const obj = {
					[tax]: termNames,
				};

				taxTermObjects.push(obj);
			}

			//ブロック要素にデータを注入する
			ModifyFieldElement(clone, pickup, taxTermObjects, block_map, i);
			//データ注入後にブロック挿入
			target_block.appendChild(clone);
		}
		//ひな型部分は非表示
		template.style.display = "none"; // jQueryの .hide() 相当
		//template 内の .hide-wrapper を全部探す
		const wrappers = template.querySelectorAll(".hide-wrapper");
		wrappers.forEach((wrapper) => {
			const parent = wrapper.parentElement;
			if (!parent) return;

			// .hide-wrapper の中身をすべて親の直下に移動
			while (wrapper.firstChild) {
				parent.insertBefore(wrapper.firstChild, wrapper);
			}

			// 空になった .hide-wrapper を削除
			parent.removeChild(wrapper);
		});
	} else {
		const target_array = Array.from(target_block.children);
		for (const [i, pickup] of pickpData.entries()) {
			const featuredMedia = pickup.featured_media;
			if (featuredMedia) {
				const mediaInfo = await getMediaInfoFromAPI(featuredMedia);
				if (mediaInfo) {
					pickup.featured_media = mediaInfo;
				}
			}
			ModifyFieldElement(target_array[i], pickup, [], block_map, i);
		}
		target_array.forEach((parent) => {
			if (!parent) return;

			// 親の直下にある .hide-wrapper を探す
			const wrapper = Array.from(parent.children).find((child) =>
				child.classList.contains("hide-wrapper"),
			);

			if (!wrapper) return;

			// wrapper の子要素を wrapper の前にどんどん移動
			while (wrapper.firstChild) {
				parent.insertBefore(wrapper.firstChild, wrapper);
			}

			// 最後に wrapper 自体を削除
			parent.removeChild(wrapper);
		});
	}
};

//テンプレートを選択する関数
function selectTemplateUnit(templateUnits, aspectRatio, itmNum) {
	let retTemplate;
	if (aspectRatio > 1.2 && itmNum % 2 !== 0) {
		retTemplate = templateUnits[0];
	} else if (aspectRatio > 1.2 && itmNum % 2 === 0) {
		retTemplate = templateUnits[1];
	} else if (aspectRatio < 0.8 && itmNum % 2 !== 0) {
		retTemplate = templateUnits[2];
	} else if (aspectRatio < 0.8 && itmNum % 2 === 0) {
		retTemplate = templateUnits[3];
	} else {
		retTemplate = templateUnits[(itmNum - 1) % 2];
	}
	return retTemplate;
}

//ピックアップ投稿の表示（ダイナミックブロックと同様の表示）・ページネーションの処理
export const pickupChange = (
	pickup,
	fillFlg,
	currentPage = 0,
	queryState = null,
) => {
	const pickupId = pickup.dataset.pickup_id;
	const pickupType = pickup.dataset.pickup_type;
	const pickupQury = pickup.dataset.pickup_query;
	const numberOfItems = pickup.dataset.number_of_items;
	//const selectedRest = pickup.dataset.selected_rest;
	const selectedSlug = pickup.dataset.selected_slug;
	const taxRelateType = pickup.dataset.tax_relate_type;
	const searchFields = JSON.parse(pickup.dataset.search_fields); //検索対象のカスタムフィールド
	const choiceFields = JSON.parse(pickup.dataset.choice_fields);
	const dispTaxonomies = JSON.parse(pickup.dataset.disp_taxonomies);
	const blockMap = JSON.parse(pickup.dataset.block_map);

	// ✅ Store 等から渡された state を優先（なければ従来のグローバルを使う）
	const qs = queryState || {};
	const _termQueryObj = qs.termQueryObj ?? termQueryObj;
	const _termParamObj = qs.termParamObj ?? termParamObj;
	const _periodQueryObj = qs.periodQueryObj ?? periodQueryObj;
	const _periodDisp = qs.periodDisp ?? periodDisp;
	const _searchKeyWord = qs.searchKeyWord ?? searchKeyWord;

	// ✅ setUrlParam はこの関数内だけで完結させる（グローバル依存を減らす）
	let _setUrlParam = "";

	// ひな型の要素をスケルトンスクリーンでラップする
	const targets = pickup.querySelectorAll(
		".unit_hide .wp-block-itmar-design-title, .wp-block-itmar-design-button, .itmar_ex_block",
	);
	targets.forEach((el) => {
		// <div class="hide-wrapper"></div> を作成
		const wrapper = document.createElement("div");
		wrapper.className = "hide-wrapper";

		// el の前に wrapper を挿入して、el を wrapper の中に移動
		el.parentNode.insertBefore(wrapper, el);
		wrapper.appendChild(el);

		// 中身を非表示
		el.style.visibility = "hidden";
	});

	//swiperが親要素でない場合
	if (!fillFlg) {
		//ひな型部分を表示
		const template = pickup.querySelector(".template_unit");
		if (!template) return; // 念のため防御
		template.style.display = "block";

		// まず .template_unit 以外の子要素を削除
		Array.from(pickup.children).forEach((child) => {
			if (!child.classList.contains("template_unit")) {
				child.remove();
			}
		});
	}

	//タームのセレクトオブジェクト
	const selectTerms =
		_termParamObj && Object.keys(_termParamObj).length > 0
			? _termParamObj
			: getSelectedTaxonomyTerms(_termQueryObj, taxRelateType);

	//URLパラメータの生成
	const termPrm = selectTerms
		? `terms=${encodeURIComponent(JSON.stringify(selectTerms))}`
		: "";

	const keyWordPrm = _searchKeyWord
		? `keyWord=${encodeURIComponent(_searchKeyWord)}`
		: "";

	const periodPrm = _periodDisp
		? `period=${encodeURIComponent(_periodDisp)}`
		: "";
	// パラメータを配列にまとめて、空文字を除外
	const params = [keyWordPrm, periodPrm, termPrm].filter(
		(param) => param !== "",
	);
	// パラメータが存在する場合のみ`?`で結合
	_setUrlParam = params.length > 0 ? `?${params.join("&")}` : "";

	//post-filterの操作による変更である場合に現在のURLに追加
	const currentUrl = new URL(window.location.href);
	if (keyWordPrm) {
		currentUrl.searchParams.set("keyWord", _searchKeyWord);
	} else {
		currentUrl.searchParams.delete("keyWord");
	}

	if (periodPrm) {
		currentUrl.searchParams.set("period", _periodDisp);
	} else {
		currentUrl.searchParams.delete("period");
	}

	if (_termQueryObj.length == 0 && !_termParamObj) {
		currentUrl.searchParams.delete("terms");
	} else {
		currentUrl.searchParams.set("terms", JSON.stringify(selectTerms));
	}
	// URLを更新
	history.pushState(null, "", currentUrl);

	//全体のクエリオブジェクト
	const query =
		pickupQury === "nomal"
			? {
					search: _searchKeyWord,
					custom_fields: choiceFields,
					search_fields: searchFields,
					post_type: selectedSlug,
					per_page: pickupType === "multi" ? numberOfItems : -1,
					page: currentPage + 1,
					...selectTerms,
					..._periodQueryObj,
			  }
			: {
					custom_fields: choiceFields,
					post_type: selectedSlug,
					per_page: numberOfItems,
					...selectTerms,
					meta_key: "view_counter",
					orderby: "meta_value_num",
					order: "desc", // 降順 (アクセス数の多い順)
			  };

	//カスタムエンドポイントから投稿データを取得
	return getSearchRecordsFromAPI(query)
		.then((data) => {
			let targetIndex = -1;
			const rawPosts = data?.posts ?? [];

			let postsToRender = [];
			if (pickupType === "multi") {
				postsToRender = rawPosts;
			} else {
				targetIndex = rawPosts.findIndex((post) =>
					post.link?.includes(itmar_post_option?.slug),
				);
				if (targetIndex !== -1) postsToRender = [rawPosts[targetIndex]];
			}

			const target_block = !fillFlg ? pickup : pickup.parentElement;

			replaceContent(
				postsToRender,
				target_block,
				blockMap,
				fillFlg,
				pickupType,
				dispTaxonomies,
			);

			const total = data?.total ?? 0;

			return {
				total,
				posts: postsToRender,
				rawPosts,
				targetIndex,
			};
		})
		.catch((error) => console.error(error));
};

export const paramToObject = (prm, taxArray) => {
	return Object.entries(prm)
		.filter(([key, value]) => key !== "tax_relation") // 不要なキーを除外
		.flatMap(([key, value]) => {
			// カンマ区切りを配列化して処理
			const values =
				typeof value === "string" ? value.split(",").map(Number) : [value];
			return values.flatMap((val) =>
				taxArray.flatMap((item) =>
					item.terms
						.filter((term) => term.id === val)
						.map((term) => ({
							taxonomy: item.value,
							term: {
								id: term.id,
								slug: term.slug,
								name: term.name,
							},
						})),
				),
			);
		});
};
