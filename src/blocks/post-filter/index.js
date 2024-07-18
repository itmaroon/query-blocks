import { __ } from "@wordpress/i18n";
import { registerBlockType } from "@wordpress/blocks";
import "./style.scss";

/**
 * Internal dependencies
 */
import Edit from "./edit";
import save from "./save";
import metadata from "./block.json";
import { ReactComponent as Filter } from "./filter.svg";

registerBlockType(metadata.name, {
	description: __(
		"This block provides users with the ability to set filters such as category and date for the Post Block.",
		"post-blocks",
	),

	icon: <Filter />,
	edit: Edit,
	save,
});
