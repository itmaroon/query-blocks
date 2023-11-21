<?php
/**
 * Plugin Name:       Post Blocks
 * Plugin URI:        https://itmaroon.net
 * Description:       A collection of blocks that display WordPress posts
 * Requires at least: 6.1
 * Requires PHP:      7.0
 * Version:           0.1.0
 * Author:            Web Creator ITmaroon
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       itmar_post_blocks
 * Domain Path:       /languages
 *
 * @package           itmar
 */

/**
 * Registers the block using the metadata loaded from the `block.json` file.
 * Behind the scenes, it registers also all assets so they can be enqueued
 * through the block editor in the corresponding context.
 *
 * @see https://developer.wordpress.org/reference/functions/register_block_type/
 */

 if ( ! defined( 'ABSPATH' ) ) exit;
 
function itmar_post_blocks_block_init() {
	foreach (glob(plugin_dir_path(__FILE__) . 'build/blocks/*') as $block) {
			register_block_type($block);
	}
}
add_action( 'init', 'itmar_post_blocks_block_init' );
