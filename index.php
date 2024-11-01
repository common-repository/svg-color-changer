<?php
/*
 * Plugin Name: SVG Color Changer
 * Plugin URI: https://shop.48design.com/svg-color-changer
 * Description: Allows to change the colors in uploaded SVG files. Colors can even be changed in all SVG files at once, e.g. when changing a company's brand color or adapting a white label solution.
 * Version: 1.0.3
 * Author: 48DESIGN GmbH
 * Author URI: https://www.vierachtdesign.com/
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: svg-color-changer
 * Domain Path: /languages
 * Tested up to: 6.6.2
 * Requires at least: 3.9.0
 * Requires PHP: 5.6.0
 */

defined('ABSPATH') or die('Direct script access disallowed.');
define('WP_SVGCC_MAINFILE', __FILE__);
define('WP_SVGCC_VERSION', '1.0.3');

$vad_laum_file = __DIR__ . '/includes/vad-updater/wp-licensing-and-update-module.php';
if ( is_file( $vad_laum_file ) ) {
	require_once( $vad_laum_file );
	$VAD_WP_LAUM->productOptions = array(
		'PID' => 'dc70336f01a1ef4d9a5e9b99e689e063f2b0653b9cba40bb515bb08d5a11d9a4',
		'multiple' => false,
	);
}

include_once(plugin_dir_path(__FILE__) . 'svg-color-changer.php');

function svgcc_initialize() {
    new SVGColorChanger();
}

add_action('plugins_loaded', 'svgcc_initialize');
