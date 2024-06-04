import { __ } from "@wordpress/i18n";
import { registerBlockType } from "@wordpress/blocks";
import "./style.scss";

/**
 * Internal dependencies
 */
import Edit from "./edit";
import save from "./save";
import metadata from "./block.json";
import { ReactComponent as Pickup } from "./pickup.svg";

registerBlockType(metadata.name, {
	icon: <Pickup />,
	description: __(
		"This block picks up and displays articles that you want to draw attention to.",
		"itmar_post_blocks",
	),

	edit: Edit,
	save,
});
