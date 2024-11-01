=== SVG Color Changer ===
Contributors: 48design
Donate link: https://www.48design.com/donate/
Tags: svg, batch, color changer, media library, colour
Tested up to: 6.6.2
Requires at least: 3.9.0
Stable tag: 1.0.3
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Change colors in uploaded SVG files individually or in bulk, ideal for brand color updates or white label solutions.

== Installation ==

Simply install the plugin from the WordPress plugin directory.

== Usage ==

You'll find a new entry in the admin "Media" submenu. It will pick the most commonly used colors from all the SVG files for easy batch processing, as well as all the colors used in each single SVG file. Use the color pickers to change the color values and save them to the file(s), that's it!

== FAQ ==

= Which color notations are supported? ==

Currently, #HEX (3 or 6 digits without alpha, 4 or 8 digits with alpha) and rgb()/rgba() (both with or without alpha values for compatibility reasons).
Supported color formats will be converted automatically in order to match the same color in different notations.

= Is there a live preview of the changed color? =

When changing a color using a color picker for a single file, the color will change instantly in the preview image.

= Why is there no live preview when changing the colors for all files? =

Due to performance reasons, live preview is only available when changing a color for a single file. However, upon hovering a color picker for all files, the corresponding color picker for each file will be highlighted.

== Changelog ==

= 1.0.3 =
* tested with latest WordPress version

= 1.0.2 =
* Initial commit to plugin directory

= 1.0.0 =
* Initial release
* Hex, rgb() and rgba() notations with automatic conversion
* Batch processing support
