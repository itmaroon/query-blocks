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

//検索のためのカスタムエンドポイント
add_action('rest_api_init', function () {
	register_rest_route('itmar-rest-api/v1', '/search', array(
		'methods' => 'GET',
		'callback' => 'itmar_search_endpoint',
		'permission_callback' => '__return_true' //常に許可
	));
});

function itmar_search_endpoint($request)
{
	$search_term = $request->get_param('search');
	$post_type = $request->get_param('post_type') ? $request->get_param('post_type') : 'post';
	$per_page = $request->get_param('per_page') ? (int) $request->get_param('per_page') : 10;
	$page = $request->get_param('page') ? (int) $request->get_param('page') : 1;

	// カスタムフィールドの配列（検索対象にしたいフィールドを指定）
	$custom_fields = array('custom_field_key', 'schedule');

	$args = array(
		'post_type' => $post_type,
		'posts_per_page' => $per_page,
		'paged' => $page,
		'post_status' => 'publish',
		's' => $search_term,
	);

	// メタクエリの作成
	$meta_query = array('relation' => 'OR');
	foreach ($custom_fields as $field) {
		$meta_query[] = array(
			'key' => $field,
			'value' => $search_term,
			'compare' => 'LIKE'
		);
	}

	$args['meta_query'] = $meta_query;

	// クエリの実行
	$query = new WP_Query($args);

	$posts = array();
	if ($query->have_posts()) {
		while ($query->have_posts()) {
			$query->the_post();
			$post_id = get_the_ID();

			// 投稿データの取得
			$post_data = array(
				'id' => $post_id,
				'date' => get_the_date('c'),
				'date_gmt' => get_the_date('c', get_the_ID()),
				'guid' => array('rendered' => get_the_guid()),
				'modified' => get_the_modified_date('c'),
				'modified_gmt' => get_the_modified_date('c', get_the_ID()),
				'slug' => get_post_field('post_name', $post_id),
				'status' => get_post_status(),
				'type' => get_post_type(),
				'link' => get_permalink(),
				'title' => array('rendered' => get_the_title()),
				'content' => array('rendered' => apply_filters('the_content', get_the_content())),
				'excerpt' => array('rendered' => get_the_excerpt()),
				'author' => (int) get_the_author_meta('ID'),
				'featured_media' => get_post_thumbnail_id($post_id),
				'comment_status' => get_post_field('comment_status', $post_id),
				'ping_status' => get_post_field('ping_status', $post_id),
				'sticky' => is_sticky($post_id),
				'template' => get_page_template_slug($post_id),
				'format' => get_post_format($post_id) ?: 'standard',
				'meta' => array(),
				'categories' => wp_get_post_categories($post_id, array('fields' => 'ids')),
				'tags' => wp_get_post_tags($post_id, array('fields' => 'ids')),
			);

			// カスタムフィールドの値を追加
			foreach ($custom_fields as $field) {
				$post_data['meta'][$field] = get_post_meta($post_id, $field, true);
			}

			// ACFフィールドがある場合
			if (function_exists('get_fields')) {
				$acf_fields = get_fields($post_id);
				if ($acf_fields) {
					$post_data['acf'] = $acf_fields;
				}
			}

			$posts[] = $post_data;
		}
	}

	wp_reset_postdata();

	$response = array(
		'total' => $query->found_posts,
		'pages' => $query->max_num_pages,
		'current_page' => $page,
		'posts' => $posts
	);

	return new WP_REST_Response($response, 200);
}
