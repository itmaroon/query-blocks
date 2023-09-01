import { __ } from '@wordpress/i18n';
import { registerBlockType } from '@wordpress/blocks';
import './style.scss';

/**
 * Internal dependencies
 */
import Edit from './edit';
import metadata from './block.json';
import { ReactComponent as Slider } from './slider.svg';

registerBlockType(metadata.name, {
	icon: <Slider />,
	description: __("A block that displays several posts in a slider format.", 'itmar_post_blocks'),

	edit: Edit,
});
