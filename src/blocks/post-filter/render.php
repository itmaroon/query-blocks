<?php
//blockからの情報取得
//$wrapper_attributes = get_block_wrapper_attributes();
$pickup_id = isset($attributes['selectedBlockId']) ? $attributes['selectedBlockId'] : '';

//jsで使えるようにattributesをローカライズ
wp_enqueue_script('render_handle', plugins_url('../../../assets/render.js', __FILE__), array(), '1.0', true);
wp_localize_script('render_handle', 'blockAttributes', array(
	'groupBlockAttributes' => $groupBlock_attr,
	'numBlockAttributes' => $numBlock_attr,
	'dummyBlockAttributes' => $dummyBlock_attr,
	'forwardBlockAttributes' => $forwordBlock_attr,
	'backBlockAttributes' => $backBlock_attr
));

$output = "<div id='filter_" . $pickup_id . "'/>"; //ブロックのラッパー
echo $output;
