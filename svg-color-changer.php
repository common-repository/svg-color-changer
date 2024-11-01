<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class SVGColorChanger {

    // Regular expression for matching SVG files
    private $svgRegexPattern = '/^.+\.svg$/i';
    // Regular expressions for matching Hex, RGB, and RGBA colors
    private $hex_pattern = "/(?<!id=\"|url\()#([a-f0-9]{8}|[a-f0-9]{6}|[a-f0-9]{4}|[a-f0-9]{3})\b/i";
    private $rgba_pattern = "/(?<!id=\"|url\()(?:rgba?)\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([01](?:\.\d+)?))?\s*\)/i";
    private $rgba_alpha_pattern = "/(?<!id=\"|url\()rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(\d*(?:\.\d+)?)\s*\)/i";

    public function __construct() {
        $this->add_actions();
    }

    private function add_actions() {
        $actions = [
            'init' => 'load_textdomain',
            'admin_enqueue_scripts' => 'enqueue_scripts',
            'admin_menu' => 'add_menu_page',
            'wp_ajax_get_svg_file_paths' => 'get_svg_file_paths',
            'wp_ajax_replace_color_in_file' => 'replace_color_in_file',
            'wp_ajax_generate_unique_colors' => 'generate_unique_colors'
        ];
        foreach ($actions as $hook => $callback) {
            add_action($hook, [$this, $callback]);
        }
    }

    public function enqueue_scripts() {
        wp_enqueue_script('jquery');

        wp_enqueue_script('svgcc_js', plugins_url('/js/svgcc.js', WP_SVGCC_MAINFILE), array('jquery'), WP_SVGCC_VERSION, true);
        wp_enqueue_style('svgcc_css', plugins_url('/css/svgcc.css', WP_SVGCC_MAINFILE), array(), WP_SVGCC_VERSION);

        wp_enqueue_style('wp-color-picker');
        wp_enqueue_script( 'wp-color-picker-alpha', plugins_url( '/js/wp-color-picker-alpha.min.js',  WP_SVGCC_MAINFILE ), array( 'wp-color-picker' ), '3.0.0', true );

        $palette = true;

        // try to get theme (enfold) colors
        if (function_exists('avia_get_option')) {
            // all color options
            $palette = array_unique(array_filter(avia_get_option(), function($key) {
                return strpos($key, "colorset-") === 0;
            }, ARRAY_FILTER_USE_KEY));
            // filter main colors
            $filteredColors = array_filter($palette, function($key) {
                return preg_match('/-primary$|-color$|-meta$/', $key);
            }, ARRAY_FILTER_USE_KEY);

            $palette = array_unique(array_values($filteredColors));
        }

        wp_localize_script('svgcc_js', 'svgcc_vars', array(
            'nonce' => wp_create_nonce('svgcc_nonce'),
            'ajax_url' => admin_url('admin-ajax.php'),
            'palette' => $palette,
        ));
    }

    public function load_textdomain() {
        load_plugin_textdomain( 'svg-color-changer', false, dirname( plugin_basename( WP_SVGCC_MAINFILE ) ) . '/languages' );
    }

    public function add_menu_page() {
        add_submenu_page('upload.php', __( 'SVG Color Changer', 'svg-color-changer' ), __( 'SVG Color Changer', 'svg-color-changer' ), 'manage_options', 'svg-color-changer', array($this, 'menu_page_callback'));
    }

    public function menu_page_callback() {
        ?>
        <form autocomplete="off">
        <div class="svgcc wrap">
            <h1 class="wp-heading-inline"><?php esc_html_e('SVG Color Changer', 'svg-color-changer'); ?></h1>
            <hr class="wp-header-end">
            <div class="svgcc-container">
                <div class="svgcc-color-selection-container">
                    <h2><?php esc_html_e('Unique Colors', 'svg-color-changer'); ?></h2>
                    <div class="svgcc-svg-controls wp-filter">
                        <select id="svgcc-top-colors">
                            <option value="<?php echo esc_attr( PHP_INT_MAX )   ; ?>"><?php esc_html_e('All colors', 'svg-color-changer'); ?></option>
                            <option value="1"><?php
                                esc_html_e('Main color', 'svg-color-changer');
                            ?></option>
                            <option value="5"><?php
                                // translators: %d: number of colors to show
                                echo esc_html( sprintf( __( 'Top %d', 'svg-color-changer' ), 5 ) );
                                ?></option>
                            <option value="10" selected><?php
                                // translators: %d: number of colors to show
                                echo esc_html( sprintf( __( 'Top %d', 'svg-color-changer' ), 10 ) );
                                ?></option>
                            <option value="25"><?php
                                // translators: %d: number of colors to show
                                echo esc_html( sprintf( __( 'Top %d', 'svg-color-changer' ), 25 ) );
                                ?></option>
                            <option value="50"><?php
                                // translators: %d: number of colors to show
                                echo esc_html( sprintf( __( 'Top %d', 'svg-color-changer' ), 50 ) );
                                ?></option>
                            <option value="100"><?php
                                // translators: %d: number of colors to show
                                echo esc_html( sprintf( __( 'Top %d', 'svg-color-changer' ), 100 ) );
                            ?></option>
                        </select>
                        <button type="button" class="svgcc-reset-color button button-secondary" disabled><?php esc_html_e('Reset Colors', 'svg-color-changer'); ?></button>
                        <button type="button" class="svgcc-replace-color button button-primary" data-svg-path="all"><?php esc_html_e('Change All Colors', 'svg-color-changer'); ?></button>
                    </div>
                    <div id="svgcc-unique-colors"></div>
                </div>
                <hr/>
            </div>

            <h2><?php esc_html_e('All SVGs Uploaded', 'svg-color-changer'); ?></h2>
            <div class="svgcc-svg-controls wp-filter all-select">
                <label>
                    <input type='checkbox' class='svgcc-selector'/>
                </label>
            </div>
            <div id="svgcc-svg-list">
            <?php
            $svgFiles = $this->get_svg_files();
            foreach ($svgFiles as $relativePath => $absolutePath) {
                $urlPath = $this->abs_path_to_url($absolutePath);
            ?>
                <div class='svgcc-row'>
                    <div class='svgcc-svg-list-item-header'>
                        <label>
                            <input type='checkbox' class='svgcc-selector' id='svgcc-<?php echo esc_attr( sha1($absolutePath) ); ?>'/>
                            <?php echo esc_html( $relativePath ); ?>
                        </label>
                    </div>
                    <div class='svgcc-svg-list-item'>
                        <iframe src="<?php echo esc_url( $urlPath ) ?>?<?php echo esc_attr( filemtime( $absolutePath ) ) ?>" class="svgcc-svg-preview" sandbox="allow-same-origin" scrolling="no"></iframe>

                        <div class='svgcc-svg-colors'>
                        <?php
                        $svgColors = $this->get_colors_from_svg($absolutePath);
                        foreach ($svgColors as $color) {
                            $color = strtolower($color);
                        ?>
                            <input class='svgcc-color-picker' type='text' value='<?php echo esc_attr( $color ); ?>' data-original='<?php echo esc_attr( $color ); ?>' data-alpha-enabled='true' data-alpha-color-type='hex' />
                        <?php } ?>
                        </div>

                        <div class='svgcc-svg-controls'>
                            <button type='button' class='svgcc-reset-color button button-secondary' disabled><?php esc_html_e('Reset Colors', 'svg-color-changer'); ?></button>
                            <button type='button' class='svgcc-replace-color button button-primary' data-svg-path='<?php echo esc_attr( $absolutePath ); ?>'><?php esc_html_e('Change Colors', 'svg-color-changer'); ?></button>
                        </div>
                    </div>
                </div>
            <?php } ?>
            </div>
        </div>
        </form>
        <?php
    }

    private function abs_path_to_url( $path = '' ) {
        $url = str_ireplace(
            wp_normalize_path( untrailingslashit( ABSPATH ) ),
            site_url(),
            wp_normalize_path( $path )
        );
        return esc_url_raw( $url );
    }

    public function get_svg_file_paths() {
        if(!check_ajax_referer('svgcc_nonce')) {
            wp_send_json_error('Invalid nonce.');
		}
		if(!current_user_can('manage_options')) {
            wp_send_json_error('Access denied.');
		}
        wp_send_json($this->get_svg_files());
    }

    /**
     *
     */
    private function get_svg_files() {

        $upload_dir = wp_upload_dir()['basedir'];
        $directory = new RecursiveDirectoryIterator($upload_dir);
        $iterator = new RecursiveIteratorIterator($directory);
        $regex = new RegexIterator($iterator, $this->svgRegexPattern, RecursiveRegexIterator::GET_MATCH);

        $svg_files = array();
        foreach($regex as $name => $object) {
            $relativePath = strstr($name, 'uploads');
            $svg_files[$relativePath] = $name;
        }

        return $svg_files;
    }

    private function is_svg($string) {
        return preg_match($this->svgRegexPattern, $string) && file_exists($string) && is_readable($string);
    }

    private function is_color($string) {
        return $this->detect_color_notation( $string ) !== null;
    }

    private function detect_color_notation($color) {
        if (preg_match($this->hex_pattern, $color)) {
            return 'hex';
        } elseif (preg_match($this->rgba_pattern, $color)) {
            return 'rgb';
        }
        return null;
    }

    private function get_all_color_notations($color) {
        $notation = $this->detect_color_notation($color);
        $notations = [$color]; // always include the original color

        switch ($notation) {
            case 'hex':
                // Convert to other hex forms
                $converted_hex_colors = $this->convert_hex_to_all_forms($color);
                $notations = array_unique(array_merge($notations, $converted_hex_colors));

                // Convert HEX to RGB/RGBA notations
                $converted_rgb_colors = $this->convert_hex_to_rgb($color);
                $notations = array_unique(array_merge($notations, $converted_rgb_colors));
                break;

            case 'rgb':
                // Convert RGB/RGBA to alternative RGB/RGBA notations
                $alternative_rgb_colors = $this->convert_rgb_to_alternative_rgb($color);
                $notations = array_unique(array_merge($notations, $alternative_rgb_colors));

                // Convert RGB/RGBA to HEX and then to all HEX forms
                $hex = $this->convert_rgb_to_hex($color);
                if ($hex) {
                    $notations[] = $hex;
                    $converted_hex_colors = $this->convert_hex_to_all_forms($hex);
                    $notations = array_unique(array_merge($notations, $converted_hex_colors));
                }
                break;
        }

        return $notations;
    }

    private function convert_hex_to_all_forms($hex) {
        $hex = ltrim($hex, '#');
        $length = strlen($hex);
        $notations = [];

        switch ($length) {
            case 3:
                // Convert 3-digit hex to 4-digit form
                $notations[] = '#' . $hex . 'f';
                // Convert 3-digit hex to 6-digit form
                $hex6 = '#' . $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
                $notations[] = $hex6;
                // Convert 3-digit hex to 8-digit form
                $notations[] = $hex6 . 'ff';
                break;
            case 4:
                if ( strtolower( $hex[3] ) == 'f' ) {
                    // Convert 4-digit hex to 3-digit form
                    $notations[] = '#' . $hex[0] . $hex[1] . $hex[2];
                    // Convert 4-digit hex to 6-digit form
                    $notations[] = '#' . $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
                }
                // Convert 4-digit hex to 8-digit form
                $notations[] = '#' . $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2] . $hex[3] . $hex[3];
                break;
            case 6:
                // Convert 6-digit hex to 3-digit form (only if it can be accurately represented)
                if ($hex[0] == $hex[1] && $hex[2] == $hex[3] && $hex[4] == $hex[5]) {
                    $hex3 = '#' . $hex[0] . $hex[2] . $hex[4];
                    $notations[] = $hex3;
                    // also convert to 4-digit form
                    $notations[] = $hex3 . 'f';
                }
                // Convert 6-digit hex to 8-digit form
                $notations[] = '#' . $hex . 'ff';
                break;
            case 8:
                if ( strtolower( $hex[6] ) == 'f' && strtolower( $hex[7] ) == 'f' ) {
                    // no alpha, treat as 6-digit hex
                    return $this->convert_hex_to_all_forms( substr( $hex, 0, 6 ) );
                }

                // Convert 8-digit hex to 4-digit form if it can be accurately represented
                if ($hex[0] == $hex[1] && $hex[2] == $hex[3] && $hex[4] == $hex[5] && $hex[6] == $hex[7]) {
                    $notations[] = '#' . $hex[0] . $hex[2] . $hex[4] . $hex[6];
                }
                break;
        }

        return $notations;
    }

    private function convert_rgb_to_hex($rgb) {
        if (preg_match($this->rgba_pattern, $rgb, $matches)) {
            $r = intval($matches[1]);
            $g = intval($matches[2]);
            $b = intval($matches[3]);
            $a = isset($matches[4]) ? floatval($matches[4]) : null;

            if (!is_null($a)) {
                // Convert alpha from [0, 1] to [0, 255]
                $alpha = dechex((int)round($a * 255));
                return sprintf("#%02x%02x%02x%02s", $r, $g, $b, $alpha);
            } else {
                return sprintf("#%02x%02x%02x", $r, $g, $b);
            }
        }

        return null;
    }

    private function convert_rgb_to_alternative_rgb($rgb) {
        $notations = [];

        if (preg_match($this->rgba_pattern, $rgb, $matches)) {
            if (isset($matches[4])) { // If it's RGBA
                $notations[] = "rgb({$matches[1]},{$matches[2]},{$matches[3]},$matches[4])";
                $notations[] = "rgba({$matches[1]},{$matches[2]},{$matches[3]},$matches[4])";
                if ($matches[4] == 1) {
                    $notations[] = "rgb({$matches[1]},{$matches[2]},{$matches[3]})";
                    $notations[] = "rgba({$matches[1]},{$matches[2]},{$matches[3]})";
                }
            } else { // If it's RGB
                $notations[] = "rgba({$matches[1]},{$matches[2]},{$matches[3]},1)";
                $notations[] = "rgb({$matches[1]},{$matches[2]},{$matches[3]},1)";
                $notations[] = "rgba({$matches[1]},{$matches[2]},{$matches[3]})";
                $notations[] = "rgb({$matches[1]},{$matches[2]},{$matches[3]})";
            }
        }

        return $notations;
    }

    private function convert_hex_to_rgb($hex) {
        $hex = ltrim($hex, '#');
        $notations = [];

        switch (strlen($hex)) {
            case 3: // 3-digit HEX
            case 6: // 6-digit HEX
                list($r, $g, $b) = strlen($hex) == 3 ? [
                    hexdec($hex[0] . $hex[0]),
                    hexdec($hex[1] . $hex[1]),
                    hexdec($hex[2] . $hex[2])
                ] : [
                    hexdec(substr($hex, 0, 2)),
                    hexdec(substr($hex, 2, 2)),
                    hexdec(substr($hex, 4, 2))
                ];
                $notations[] = "rgb($r,$g,$b)";
                $notations[] = "rgb($r,$g,$b,1)";
                $notations[] = "rgba($r,$g,$b,1)";
                break;

            case 4: // 4-digit HEX with alpha
            case 8: // 8-digit HEX with alpha
                list($r, $g, $b, $a) = strlen($hex) == 4 ? [
                    hexdec($hex[0] . $hex[0]),
                    hexdec($hex[1] . $hex[1]),
                    hexdec($hex[2] . $hex[2]),
                    round(hexdec($hex[3] . $hex[3]) / 255, 2)
                ] : [
                    hexdec(substr($hex, 0, 2)),
                    hexdec(substr($hex, 2, 2)),
                    hexdec(substr($hex, 4, 2)),
                    round(hexdec(substr($hex, 6, 2)) / 255, 2)
                ];
                $notations[] = "rgba($r,$g,$b,$a)";
                if ( $a == 1 ) {
                    $notations[] = "rgba($r,$g,$b)";
                    $notations[] = "rgb($r,$g,$b)";
                }
                break;
        }

        return $notations;
    }

    // Convert HEX (with alpha) to rgba()
    private function convert_hex_to_rgba($hex) {
        $hex = ltrim($hex, '#');
        $length = strlen($hex);

        switch ($length) {
            case 8:
                $r = hexdec(substr($hex, 0, 2));
                $g = hexdec(substr($hex, 2, 2));
                $b = hexdec(substr($hex, 4, 2));
                $a = hexdec(substr($hex, 6, 2)) / 255;
                return "rgba($r,$g,$b,$a)";
            case 6:
                $r = hexdec(substr($hex, 0, 2));
                $g = hexdec(substr($hex, 2, 2));
                $b = hexdec(substr($hex, 4, 2));
                return "rgba($r,$g,$b,1)";
            default:
                return $hex; // If it's not 6 or 8 digits, return the original value
        }
    }

    // Convert HEX to 6-digit format
    private function convert_to_6_digit_hex($hex) {
        $hex = ltrim($hex, '#');
        $length = strlen($hex);

        switch ($length) {
            case 3:
                return '#' . $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
            case 4:
                return '#' . $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2]; // Ignoring the alpha value
            case 6:
            case 8:
                return '#' . substr($hex, 0, 6); // Return the first 6 digits
            default:
                return $hex; // If it's not 3, 4, 6, or 8 digits, return the original value
        }
    }

    private function get_color_pattern($color) {
        $notation = $this->detect_color_notation($color);

        switch ($notation) {
            case 'hex':
                return '/(?<!id=\"|url\()'. preg_quote($color, '/') . '\b/i';
            case 'rgb':
                $pattern = preg_quote($color, '/');

                // if the color has an alpha value of 1, account for potential 0s as decimal places
                if (preg_match($this->rgba_alpha_pattern, $color)) {
                    $pattern = str_replace(',1\)', ',1(?:\.0+)?\)', $pattern);
                }

                // Adjust for potential spaces:
                // Strip all existing spaces first
                $pattern = str_replace(' ', '', $pattern);
                // Replace commas in the pattern with a regex that allows for optional spaces
                $pattern = str_replace(',', '\s*,\s*', $pattern);
                // Add optional spaces after the opening bracket and before the closing bracket
                $pattern = str_replace('\(', '\(\s*', $pattern);
                $pattern = str_replace('\)', '\s*\)', $pattern);

                return '/(?<!id=\"|url\()'. $pattern . '(?=\s*(;|"|\'|,|}))/i';
        }

        return null;
    }

    /**
     * Replace one or many colors inside SVG files
     */
    public function replace_color_in_file() {
        if(!check_ajax_referer('svgcc_nonce')) {
            wp_send_json_error('Invalid nonce.');
		}
		if(!current_user_can('manage_options')) {
            wp_send_json_error('Access denied.');
		}
        $svg_file_path = is_array( $_POST['svg_path'] ) ?
			array_map( 'sanitize_text_field', $_POST['svg_path'] ) :
			array( sanitize_text_field( $_POST['svg_path'] ) );

        $color_pairs = isset($_POST['color_pairs']) ? array_map( function($pair) {
			return array_map( 'sanitize_text_field', $pair );
		}, $_POST['color_pairs'] ) : [];

        // If no color pairs are provided, exit early
        if(empty($color_pairs)) {
            wp_send_json_error('No color pairs provided.');
            return;
        }

        // If no SVG filepath is provided, exit early
        if(empty($svg_file_path)) {
            wp_send_json_error('No SVG provided.');
            return;
        }

        require_once(ABSPATH . 'wp-admin/includes/file.php');
        WP_Filesystem();
        global $wp_filesystem;

        foreach ($svg_file_path as $file) {
            if (!$this->is_svg($file)) continue;

            // Load the SVG content
            $svg_contents = $wp_filesystem->get_contents($file);

            // Replace colors with placeholders
            $placeholders = [];
            foreach ($color_pairs as $pair) {
                $old_color = sanitize_text_field($pair['oldColor']);
                $new_color = sanitize_text_field($pair['newColor']);

                // sanitize colors
                if (!$this->is_color($old_color) || !$this->is_color($new_color)) continue;

                $placeholder = '_SVGCC__REPLACE_COLOR_' . sha1($new_color) . '__SVGCC_';

                $old_color_notations = $this->get_all_color_notations($old_color);
                foreach ($old_color_notations as $notation) {
                    $pattern = $this->get_color_pattern($notation);
                    $svg_contents = preg_replace($pattern, $placeholder, $svg_contents);
                }

                $placeholders[$placeholder] = $new_color;
            }

            // Replace placeholders with new colors
            foreach ($placeholders as $placeholder => $new_color) {
                $svg_contents = str_replace($placeholder, $new_color, $svg_contents);
            }

            if ( empty( $svg_contents ) ) {
                wp_send_json_error('Error replacing colors: empty output');
            } else {
                // Save the adjusted SVG content
                $wp_filesystem->put_contents($file, $svg_contents, FS_CHMOD_FILE);
            }
        }

        wp_send_json_success();
    }

    /**
     * Read all color values from SVG file
     */
    private function get_colors_from_svg($svg_file) {
        require_once(ABSPATH . 'wp-admin/includes/file.php');
        WP_Filesystem();
        global $wp_filesystem;

        $contents = $wp_filesystem->get_contents($svg_file);

        preg_match_all($this->hex_pattern, $contents, $hex_matches);
        preg_match_all($this->rgba_pattern, $contents, $rgba_matches);

        // Combine all matches into one array
        $colors = array_merge($hex_matches[0], $rgba_matches[0]);

        // Convert colors based on the rules
        $converted_colors = [];
        foreach ($colors as $color) {
            if ($this->detect_color_notation($color) === 'hex') {
                if (strlen($color) == 9 && strtolower(substr($color, -2)) === 'ff') {
                    $converted_colors[] = substr($color, 0, 7); // Convert 8-digit HEX with FF alpha to 6-digit HEX
                } elseif (strlen($color) <= 7) {
                    $converted_colors[] = $this->convert_to_6_digit_hex($color); // Convert to 6-digit HEX
                } else {
                    $converted_colors[] = $this->convert_hex_to_rgba($color); // Convert to rgba() for HEX with alpha
                }
            } else {
                $rgba = $this->parse_rgba($color);
                if ($rgba && $rgba['a'] == 1) {
                    $converted_colors[] = $this->convert_rgb_to_hex($color); // Convert to 6-digit HEX
                } else {
                    $converted_colors[] = "rgba({$rgba['r']},{$rgba['g']},{$rgba['b']},{$rgba['a']})"; // Explicitly use rgba() notation
                }
            }
        }

        // Remove duplicates
        $unique_colors = array_unique(array_map('strtolower', $converted_colors));

        return $unique_colors;
    }

    // Helper function to parse RGBA values
    private function parse_rgba($color) {
        if (preg_match($this->rgba_pattern, $color, $matches)) {
            return [
                'r' => $matches[1],
                'g' => $matches[2],
                'b' => $matches[3],
                'a' => isset($matches[4]) ? $matches[4] : 1
            ];
        }
        return null;
    }

    /**
     * Get the top colors based on frequency
     */
    public function generate_unique_colors() {
        if(!check_ajax_referer('svgcc_nonce')) {
            wp_send_json_error('Invalid nonce.');
		}
		if(!current_user_can('manage_options')) {
            wp_send_json_error('Access denied.');
		}
        $svg_files = $this->get_svg_files();
        $colors = array();

        // Collect all colors
        foreach ($svg_files as $svg_file) {
            if (!$this->is_svg($svg_file)) continue;
            $colors = array_merge($colors, $this->get_colors_from_svg($svg_file));
        }

        // Count frequency
        $color_frequency = array_count_values($colors);

        // Sort by frequency and then by alpha
        uksort($color_frequency, function($colorA, $colorB) use ($color_frequency) {
            // Compare frequencies
            if ($color_frequency[$colorA] > $color_frequency[$colorB]) return -1;
            if ($color_frequency[$colorA] < $color_frequency[$colorB]) return 1;

            // Frequencies are equal, compare alpha values
            $alphaA = $this->extract_alpha($colorA);
            $alphaB = $this->extract_alpha($colorB);

            // Lower alpha values should come last
            return $alphaA > $alphaB ? -1 : 1;
        });

        // Limit number of colors according to the 'top_colors' parameter
        $limit = isset( $_POST['top_colors'] ) ?
			intval( sanitize_text_field( $_POST['top_colors'] ) ) :
			count($color_frequency);
        $color_frequency = array_slice($color_frequency, 0, $limit, true);

        wp_send_json(array_keys($color_frequency));
    }

    // Extract the alpha value from a color
    private function extract_alpha($color) {
        if (preg_match($this->rgba_alpha_pattern, $color, $matches)) {
            return isset($matches[1]) ? floatval($matches[1]) : 1;
        }
        // Not an RGB(A) color, return default alpha
        return 1;
    }

}
