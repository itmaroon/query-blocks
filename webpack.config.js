const defaultConfig = require("@wordpress/scripts/config/webpack.config");

const mode = "production";

//フロントエンドモジュールのトランスパイル
const path = require("path");
const newEntryConfig = async () => {
	const originalEntry = await defaultConfig.entry();

	return {
		...originalEntry,
		"front-module": path.resolve(__dirname, "./assets/front-module.js"),
	};
};

module.exports = {
	...defaultConfig,
	mode: mode,
	entry: newEntryConfig,
};
