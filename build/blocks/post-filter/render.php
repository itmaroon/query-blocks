<?php
//blockからの情報取得
//$wrapper_attributes = get_block_wrapper_attributes();
$pickup_id = isset($attributes['selectedBlockId']) ? $attributes['selectedBlockId'] : '';
$groupBlock_attr = isset($attributes['groupBlockAttributes']) ? $attributes['groupBlockAttributes'] : '';
$title_attr = isset($attributes['titleAttributes']) ? $attributes['titleAttributes'] : '';
$searchBox_attr = isset($attributes['serachBoxAttributes']) ? $attributes['serachBoxAttributes'] : '';
$checkBox_attr = isset($attributes['checkBoxAttributes']) ? $attributes['checkBoxAttributes'] : '';

//jsで使えるようにattributesをローカライズ
wp_enqueue_script('render_handle', plugins_url('../../../assets/render.js', __FILE__), array(), '1.0', true);
wp_localize_script('render_handle', 'filterAttributes', array(
	'groupBlockAttributes' => $groupBlock_attr,
	'titleAttributes' => $title_attr,
	'serachBoxAttributes' => $searchBox_attr,
	'checkBoxAttributes' => $checkBox_attr,
));

$output = "<div id='filter_" . $pickup_id . "'/>"; //ブロックのラッパー
echo $output;
