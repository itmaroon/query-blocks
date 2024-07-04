<?php
//blockからの情報取得
//$wrapper_attributes = get_block_wrapper_attributes();
$pickup_id = isset($attributes['selectedBlockId']) ? $attributes['selectedBlockId'] : '';
$disp_items = isset($attributes['dispOfItems']) ? $attributes['dispOfItems'] : '';
$is_arrow = isset($attributes['isArrowButton']) && $attributes['isArrowButton'] === true;
$is_arrow_string = $is_arrow ? 'true' : 'false';
$groupBlock_attr = isset($attributes['groupBlockAttributes']) ? $attributes['groupBlockAttributes'] : '';
$numBlock_attr = isset($attributes['numBlockAttributes']) ? $attributes['numBlockAttributes'] : '';
$dummyBlock_attr = isset($attributes['dummyBlockAttributes']) ? $attributes['dummyBlockAttributes'] : '';
$forwordBlock_attr = isset($attributes['forwardBlockAttributes']) ? $attributes['forwardBlockAttributes'] : '';
$backBlock_attr = isset($attributes['backBlockAttributes']) ? $attributes['backBlockAttributes'] : '';

//jsで使えるようにattributesをローカライズ
wp_enqueue_script('render_handle', plugins_url('../../../assets/render.js', __FILE__), array(), '1.0', true);
wp_localize_script('render_handle', 'blockAttributes', array(
	'groupBlockAttributes' => $groupBlock_attr,
	'numBlockAttributes' => $numBlock_attr,
	'dummyBlockAttributes' => $dummyBlock_attr,
	'forwardBlockAttributes' => $forwordBlock_attr,
	'backBlockAttributes' => $backBlock_attr
));

$output = "<div 
	id='page_" . $pickup_id .
	"' data-disp_items=" . $disp_items .
	" data-is_arrow=" . $is_arrow_string
	. ">"; //ブロックのラッパー
echo $output;
