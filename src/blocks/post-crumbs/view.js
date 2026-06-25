import { createRoot } from "react-dom/client";
import { RichText } from "@wordpress/block-editor";
import { format, getSettings } from "@wordpress/date";

import {
	restTaxonomies,
	termToDispObj,
	ensureCtx,
	subscribe,
} from "itmar-block-packages";

// ★あなたの環境に合わせて調整（front-common.js と同等の import でOK）
import { StyleComp as StyleGroup } from "../../../../block-collections/src/blocks/design-group/StyleGroup";
import { StyleComp as StyleTitle } from "../../../../block-collections/src/blocks/design-title/StyleWapper";

const roots = new Map();
const getRoot = (el) => {
	if (!roots.has(el)) roots.set(el, createRoot(el));
	return roots.get(el);
};

const parseJson = (s, fallback = {}) => {
	try {
		return s ? JSON.parse(s) : fallback;
	} catch {
		return fallback;
	}
};

// front-common の paramToObject と同等（termParamObj を termQueryObj に変換）
function paramToObject(prm, taxArray) {
	return Object.entries(prm)
		.filter(([key]) => key !== "tax_relation")
		.flatMap(([key, value]) => {
			const values =
				typeof value === "string" ? value.split(",").map(Number) : [value];
			return values.flatMap((val) =>
				taxArray.flatMap((item) =>
					item.terms
						.filter((term) => term.id === val)
						.map((term) => ({
							taxonomy: item.value,
							term: { id: term.id, slug: term.slug, name: term.name },
						})),
				),
			);
		});
}

function renderRichText(
	richText,
	titleType,
	dateFormat,
	headingType,
	title_style,
) {
	const disp =
		titleType === "date"
			? format(dateFormat, richText, getSettings())
			: richText;

	return (
		<RichText.Content
			tagName={headingType}
			value={disp}
			style={title_style ? title_style : null}
		/>
	);
}

document.addEventListener("DOMContentLoaded", () => {
	document.querySelectorAll('[id^="crumbs_"]').forEach((crumbsRoot) => {
		const pickupId = crumbsRoot.id.replace(/^crumbs_/, "");
		ensureCtx(pickupId);

		const root = getRoot(crumbsRoot);

		// save.js に合わせて data を読む
		const groupAll = parseJson(crumbsRoot.dataset.group_attributes, {});
		const crumbAll = parseJson(crumbsRoot.dataset.crumb_attributes, {});

		const { block_style: group_style, ...groupAttr } = groupAll;
		const { block_style: title_style, ...crumbAttr } = crumbAll;

		const { titleType, dateFormat, headingType } = crumbAll;

		// タクソノミー情報キャッシュ（termParamObj がある時だけ必要）
		let taxArray = null;
		let taxPromise = null;
		let latestCtx = null;

		const tryRender = () => {
			if (!latestCtx) return;

			const ctx = latestCtx;
			const state = ctx.state || {};
			const dataset = ctx.dataset || {};

			// stateキーは移行途中でも動くようにフォールバック
			const keyword = state.searchKeyWord ?? state.keyword ?? "";
			const periodDisp = state.periodDisp ?? state.period ?? "";
			const termParamObj = state.termParamObj ?? state.terms ?? null;
			const termQueryObjFromState = state.termQueryObj ?? [];

			const pickupType = dataset.pickup_type; // "single" / "multi"
			const taxRelateType = dataset.tax_relate_type || "AND";
			const posts = state.posts || [];

			// termQueryObj を確定（state優先 / なければ URL param から復元）
			let termQueryObj = Array.isArray(termQueryObjFromState)
				? termQueryObjFromState
				: [];

			if (termQueryObj.length === 0 && termParamObj) {
				// termParamObj から復元するには taxArray が必要
				if (!taxArray) {
					const pickupSlug = dataset.selected_slug; // post-pickup 由来
					if (pickupSlug && !taxPromise) {
						taxPromise = restTaxonomies(pickupSlug).then((response) => {
							taxArray = response.map((res) => ({
								value: res.slug,
								label: res.name,
								terms: res.terms,
							}));
							tryRender(); // tax取得後に再描画
						});
					}
					// taxArrayが無い間はいったん term 表示なしで描画する（落ちないのが大事）
				} else {
					termQueryObj = paramToObject(termParamObj, taxArray);
				}
			}

			// 表示配列を組む
			const crumbArray = [];
			crumbArray.push(crumbsRoot.dataset.post_name || "");

			if (keyword) crumbArray.push(`"${keyword}"`);
			if (periodDisp) crumbArray.push(periodDisp);

			if (termQueryObj.length > 0) {
				const dispObj = termToDispObj(termQueryObj, " || ");
				const dispString = Object.values(dispObj).join(` ${taxRelateType} `);
				crumbArray.push(dispString);
			}

			if (pickupType === "single" && posts[0]?.title?.rendered) {
				crumbArray.push(posts[0].title.rendered);
			}

			root.render(
				<StyleGroup attributes={groupAttr}>
					<div
						className="wp-block-itmar-design-group"
						style={group_style || null}
					>
						<div className="group_contents">
							{crumbArray
								.filter((v) => typeof v === "string" && v.trim() !== "")
								.map((crumb, i) => (
									<StyleTitle key={i} attributes={crumbAttr}>
										{renderRichText(
											crumb,
											titleType,
											dateFormat,
											headingType,
											title_style,
										)}
									</StyleTitle>
								))}
						</div>
					</div>
				</StyleGroup>,
			);
		};

		subscribe(pickupId, (ctx) => {
			latestCtx = ctx;
			tryRender();
		});
	});
});
