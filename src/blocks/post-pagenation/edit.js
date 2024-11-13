import { __ } from "@wordpress/i18n";
import "./editor.scss";

import {
	useBlockProps,
	useInnerBlocksProps,
	InspectorControls,
} from "@wordpress/block-editor";
import {
	PanelBody,
	ToggleControl,
	SelectControl,
	RangeControl,
} from "@wordpress/components";

import { useEffect, useState, useCallback } from "@wordpress/element";
import { useSelect, useDispatch } from "@wordpress/data";
import { createBlock } from "@wordpress/blocks";

import {
	useIsIframeMobile,
	useBlockAttributeChanges,
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

export default function Edit({ attributes, setAttributes, clientId }) {
	const {
		selectedBlockId,
		//currentPage,
		dispOfItems,
		isArrowButton,
		groupBlockAttributes,
		numBlockAttributes,
		dummyBlockAttributes,
		forwardBlockAttributes,
		backBlockAttributes,
	} = attributes;

	// dispatch関数を取得
	const { replaceInnerBlocks } = useDispatch("core/block-editor");

	//インナーブロックのひな型を用意
	const TEMPLATE = [];
	const blockProps = useBlockProps();
	const innerBlocksProps = useInnerBlocksProps(blockProps, {
		allowedBlocks: ["itmar/design-group", "itmar/design-button"],
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

	//属性変更関数を取得
	const { updateBlockAttributes } = useDispatch("core/block-editor");
	//エディタ内のブロックが変化したときpickupを更新
	const [pickupPosts, setPickupPosts] = useState([]);
	const [pickup, setPickup] = useState(null);
	useEffect(() => {
		//エディタ内ブロックを平坦化
		const allFlattenedBlocks = flattenBlocks(targetBlocks);
		//エディタ内ブロックからitmar/post-pickupを探索
		setPickupPosts(
			allFlattenedBlocks.filter((block) => block.name === "itmar/pickup-posts"),
		);

		//pickupブロックの取得
		setPickup(
			allFlattenedBlocks.find(
				(block) => block.attributes.pickupId === selectedBlockId,
			),
		);
	}, [targetBlocks]);

	//ボタンがクリックされたときの判定フラグ
	const [allIsClickFalse, setAllIsClickFalse] = useState(true);
	//design-blockの属性変更（クリックを含む)

	//他のブロックに属性の変更を適用
	useBlockAttributeChanges(
		clientId,
		"itmar/design-button",
		"itmar_design_number_btn",
		{ labelContent: "", disabled: false },
	);
	useBlockAttributeChanges(
		clientId,
		"itmar/design-button",
		"itmar_design_dummy_btn",
		{ labelContent: "", disabled: false },
	);

	useEffect(() => {
		if (innerBlocks[0] && innerBlocks[0].innerBlocks.length > 0) {
			//インナーブロックのレンダリング後
			//ページネーションボタンクリック時の処理
			const isClickArray = innerBlocks[0].innerBlocks.map(
				(block) => block.attributes.isClick,
			);
			const clickFlg = isClickArray.every((isClick) => isClick === false);

			setAllIsClickFalse(clickFlg);

			//グループブロックの属性を記録

			setAttributes({ groupBlockAttributes: innerBlocks[0].attributes });
			//ボタン属性を記録
			innerBlocks[0].innerBlocks.forEach((block, index) => {
				//ブロックの属性を記録
				const buttonBlockAttributes =
					block.attributes.className === "itmar_design_number_btn"
						? { numBlockAttributes: block.attributes }
						: block.attributes.className === "itmar_design_dummy_btn"
						? { dummyBlockAttributes: block.attributes }
						: block.attributes.className === "itmar_design_prev_btn"
						? { forwardBlockAttributes: block.attributes }
						: { backBlockAttributes: block.attributes };

				setAttributes(buttonBlockAttributes);
			});
		}
	}, [innerBlocks[0], innerBlocks[0]?.innerBlocks]);

	//ページの変更（ボタンクリックによる属性更新の副作用）
	//トータルの投稿数と表示数を取得
	const [currentPage, setCurrentPage] = useState(0);
	useEffect(() => {
		if (!allIsClickFalse) {
			//isClickにtrueが含まれるとき
			//トータルのページ数を算出
			const totalPages = Math.ceil(selectedPostTotal / selectedDispNum);
			//カレントページにすべきページ
			let setPage = 0;
			const isClickArray = innerBlocks[0].innerBlocks.map(
				(block) => block.attributes.isClick,
			);
			//クリックされたブロック
			const clickBlock = innerBlocks[0].innerBlocks[isClickArray.indexOf(true)];

			//クリックされたブロックのクラス名によってカレントにするページを決定
			if (clickBlock.attributes.className === "itmar_design_number_btn") {
				setPage = Number(clickBlock.attributes.labelContent) - 1;
			} else if (clickBlock.attributes.className === "itmar_design_prev_btn") {
				if (totalPages > currentPage + 1) {
					setPage = currentPage + 1;
				} else {
					setPage = currentPage;
				}
			} else if (clickBlock.attributes.className === "itmar_design_back_btn") {
				if (currentPage > 0) {
					setPage = currentPage - 1;
				} else {
					setPage = currentPage;
				}
			}
			//カレントページの変更
			//setAttributes({ currentPage: setPage });

			setCurrentPage(setPage);

			//post-pickupのカレントページの変更
			if (pickup) {
				updateBlockAttributes(pickup.clientId, {
					currentPage: setPage,
				});
			}
			//design-buttonのクリック関連属性変更
			innerBlocks[0].innerBlocks.forEach((block, index) => {
				const changeAttributes =
					(block.attributes.className === "itmar_design_number_btn" &&
						Number(block.attributes.labelContent) - 1 == setPage) ||
					block.attributes.className === "itmar_design_dummy_btn"
						? { isClick: false, disabled: true }
						: { isClick: false, disabled: false };
				updateBlockAttributes(block.clientId, changeAttributes);
			});
		}
	}, [allIsClickFalse]);

	//トータルの投稿数と表示数を取得
	const [selectedPostTotal, setSelectedPostTotal] = useState(null);
	const [selectedDispNum, setSelectedDispNum] = useState(null);

	useEffect(() => {
		if (selectedBlockId) {
			if (pickup) {
				setSelectedPostTotal(pickup.attributes.numberOfTotal);
				setSelectedDispNum(pickup.attributes.numberOfItems);
				setCurrentPage(pickup.attributes.currentPage);
			} else {
				setSelectedPostTotal(0);
				setSelectedDispNum(3);
				setCurrentPage(0);
			}
		}
	}, [pickup]); //ターゲットのpickup-blockが更新された

	//表示数と投稿数を取得したらインナーブロックにdesign-buttonを詰め込む
	useEffect(() => {
		if (selectedPostTotal != null && selectedDispNum) {
			//デフォルトのページボタンスタイル
			const defaultPos = {
				width: "3em",
				height: "3em",
				margin_value: {
					top: "10px",
					left: "10px",
					bottom: "10px",
					right: "10px",
				},
				padding_value: {
					top: "10px",
					left: "10px",
					bottom: "10px",
					right: "10px",
				},
			};
			const mobilePos = {
				...defaultPos,
				margin_value: {
					top: "10px",
					left: "0",
					bottom: "10px",
					right: "0",
				},
			};

			//トータルのページ数を算出
			const totalPages = Math.ceil(selectedPostTotal / selectedDispNum);
			//totalPagesが２ページ以上
			if (totalPages > 1) {
				//ボタンの配列
				const innerBlocksArray = [];
				//デフォルトの共通ボタン形状
				const commonDefStyle = {
					default_pos: {
						width: "3em",
						height: "3em",
						margin_value: {
							top: "10px",
							left: "10px",
							bottom: "10px",
							right: "10px",
						},
						padding_value: {
							top: "10px",
							left: "10px",
							bottom: "10px",
							right: "10px",
						},
					},
					mobile_pos: {
						width: "2em",
						height: "2em",
						margin_value: {
							top: "10px",
							left: "0",
							bottom: "10px",
							right: "0",
						},
						padding_value: {
							top: "10px",
							left: "10px",
							bottom: "10px",
							right: "10px",
						},
					},
					radius_value: {
						value: "50%",
					},
				};
				//ダミーボタンの表示フラグ
				let dummyFlg = false;
				//ページ数分ボタンを生成
				for (let index = 0; index < totalPages; index++) {
					//カレントページを軸にページ番号ボタンを生成
					let forwardNum = currentPage - (Math.ceil((dispOfItems - 2) / 2) - 1);
					let backNum = currentPage + (Math.ceil((dispOfItems - 2) / 2) - 1);
					if (dispOfItems % 2 == 0) {
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

					if (
						index == currentPage ||
						index == 0 ||
						index + 1 == totalPages ||
						(index >= forwardNum && index <= backNum)
					) {
						//表示ページが最終ページの一つより前か、最終ページの時
						const setNumAttributes = {
							className: "itmar_design_number_btn",
							align: "center",
							...commonDefStyle,
							disableButtonColor: "var(--wp--preset--color--placeholder)",
							...numBlockAttributes, //ユーザー設定を優先
							labelContent: String(index + 1),
							disabled: currentPage === index, //currentPageとindexが一致したらdisabledをオン
						};
						innerBlocksArray.push(
							createBlock("itmar/design-button", setNumAttributes),
						);
						dummyFlg = false; //ダミーフラグを下す
					} else {
						if (!dummyFlg) {
							//ダミーをプッシュしていないとき
							const setDummyAttributes = {
								className: "itmar_design_dummy_btn",
								labelContent: "...",
								align: "center",
								...commonDefStyle,
								disableButtonColor: "var(--wp--preset--color--background)",
								...dummyBlockAttributes, //ユーザー設定を優先
								disabled: true, //disabledをオン
							};
							innerBlocksArray.push(
								createBlock("itmar/design-button", setDummyAttributes),
							);
							dummyFlg = true; //ダミーフラグを立てる
						}
					}
				}
				//矢印用ボタンを挿入
				if (isArrowButton) {
					const setPrevAttributes = {
						className: "itmar_design_prev_btn",
						displayType: "pseudo",
						pseudoInfo: { element: "Arrow", option: "right" },
						...commonDefStyle,
						...forwardBlockAttributes, //ユーザー設定が最優先
					};
					const forwardButton = createBlock(
						"itmar/design-button",
						setPrevAttributes,
					);
					const setBackAttributes = {
						className: "itmar_design_back_btn",
						displayType: "pseudo",
						pseudoInfo: { element: "Arrow", option: "left" },
						...commonDefStyle,
						...backBlockAttributes, //ユーザー設定が最優先
					};
					const backButton = createBlock(
						"itmar/design-button",
						setBackAttributes,
					);

					innerBlocksArray.push(forwardButton);
					innerBlocksArray.unshift(backButton);
				}

				//Design Groupに入れてレンダリング
				//const groupBlockAttr = innerBlocks[0] ? innerBlocks[0].attributes : {};
				const pagenationBlock = createBlock(
					"itmar/design-group",
					groupBlockAttributes, //既にグループがある場合はその属性を引き継ぐ
					innerBlocksArray,
				);
				//インナーブロックを配置
				const newInnerBlocks = [pagenationBlock];
				replaceInnerBlocks(clientId, newInnerBlocks, false);
			} else {
				//２ページ以下の時は空のグループブロックを表示
				const emptyBlock = createBlock("itmar/design-group", {}, []);
				replaceInnerBlocks(clientId, emptyBlock, false);
			}
		}
	}, [
		selectedPostTotal,
		selectedDispNum,
		dispOfItems,
		isArrowButton,
		currentPage,
	]);

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
					<ToggleControl
						label={__("Is Arrow Button", "post-blocks")}
						checked={isArrowButton}
						onChange={(newVal) => {
							setAttributes({ isArrowButton: newVal });
						}}
					/>
					<RangeControl
						value={dispOfItems}
						label={__("Page Button Number", "post-blocks")}
						max={30}
						min={3}
						onChange={(val) => setAttributes({ dispOfItems: val })}
					/>
				</PanelBody>
			</InspectorControls>

			<div {...blockProps}>
				<div {...innerBlocksProps}></div>
			</div>
		</>
	);
}
