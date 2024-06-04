<?php

/**
 * Plugin Name:       Post Blocks
 * Plugin URI:        https://itmaroon.net
 * Description:       A collection of blocks that display WordPress posts
 * Requires at least: 6.3
 * Requires PHP:      8.1.22
 * Version:           0.1.0
 * Author:            Web Creator ITmaroon
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       post-blocks
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

//PHPファイルに対する直接アクセスを禁止
if (!defined('ABSPATH')) exit;

//composerによるリモートリポジトリからの読み込みを要求
require_once __DIR__ . '/vendor/autoload.php';

// プラグイン情報取得に必要なファイルを読み込む
if (!function_exists('get_plugin_data')) {
	require_once(ABSPATH . 'wp-admin/includes/plugin.php');
}


$block_entry = new \Itmar\BlockClassPakage\ItmarEntryClass();

//ブロックの登録
add_action('init', function () use ($block_entry) {
	$plugin_data = get_plugin_data(__FILE__);
	$block_entry->block_init($plugin_data['TextDomain'], __FILE__);
});

function itmar_post_blocks_front()
{
	//管理画面以外（フロントエンド側でのみ読み込む）
	if (!is_admin()) {
		$script_path = plugin_dir_path(__FILE__) . 'build/front-module.js';
		wp_enqueue_script(
			'post_front_handle',
			plugins_url('build/front-module.js?', __FILE__),
			array(),
			filemtime($script_path),
			true
		);
	}
}

add_action('enqueue_block_assets', 'itmar_post_blocks_front');
