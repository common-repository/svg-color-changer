(function($) {
    const svgccUniqueColors = $('#svgcc-unique-colors');
    const svgccTopColors = $('#svgcc-top-colors');

    function escapeRegExp(string) {
        return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }

    function createFlexibleColorRegExp(color) {
        if (color.startsWith('rgba') || color.startsWith('rgb')) {
            return escapeRegExp(color).replace(/,/g, ',\\s*'); // Replace commas with optional spaces regex
        } else {
            return escapeRegExp(color);
        }
    }

    function hexToRgbaConditional(hex) {
        // Remove the "#" symbol if present
        hex = hex.replace(/^#/, '');

        // Extract the components
        const red = parseInt(hex.substring(0, 2), 16);
        const green = parseInt(hex.substring(2, 4), 16);
        const blue = parseInt(hex.substring(4, 6), 16);
        const alpha = parseInt(hex.substring(6, 8), 16) / 255;

        if (alpha === 1) {
            // Convert to 6-character hex color if alpha is 1
            const hexColor = `#${hex.substring(0, 6)}`;
            return hexColor;
        }

        // Round alpha to a maximum of 2 decimal places
        const roundedAlpha = Math.round(alpha * 100) / 100;

        // Create the RGBA string
        const rgba = `rgba(${red}, ${green}, ${blue}, ${roundedAlpha})`;

        return rgba;
    }

    function rgbToHex(color, useShortNotation = false) {
        // Parse the color string to extract the individual components
        const match = color.trim().match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+)\s*)?\)$/);
        if (!match) {
          return null; // Invalid color format
        }

        const red = parseInt(match[1]);
        const green = parseInt(match[2]);
        const blue = parseInt(match[3]);
        const alpha = match[4] ? parseFloat(match[4]) : 1;

        // Ensure the color components are within valid ranges
        if (red < 0 || red > 255 || green < 0 || green > 255 || blue < 0 || blue > 255 || alpha < 0 || alpha > 1) {
        return null; // Invalid color component values
        }

        // Convert the color components to hexadecimal
        const hexRed = red.toString(16).padStart(2, '0');
        const hexGreen = green.toString(16).padStart(2, '0');
        const hexBlue = blue.toString(16).padStart(2, '0');
        const hexAlpha = Math.round(alpha * 255).toString(16).padStart(2, '0');

        // Determine whether to use short notation
        const shouldUseShort = useShortNotation && (hexRed[0] === hexRed[1] && hexGreen[0] === hexGreen[1] && hexBlue[0] === hexBlue[1] && hexAlpha[0] === hexAlpha[1]);

        // Construct the hex notation
        let hexColor = `#${hexRed}${hexGreen}${hexBlue}`;
        if (!shouldUseShort && alpha < 1) {
            hexColor += hexAlpha;
        }

        return hexColor;
    }

    /**
     * Highlight matching colors
     */
    function highlightMatchingColors(element) {
        const originalColor = $(element).find('.svgcc-color-picker').attr('data-original');
        $('#svgcc-svg-list .svgcc-color-picker[data-original="' + originalColor + '"]').closest('.wp-picker-container').find('.wp-color-result').css('outline', `2px solid #ff00ff`);
    }
    function removeHighlightFromMatchingColors(element) {
        $('#svgcc-svg-list .svgcc-color-picker').closest('.wp-picker-container').find('.wp-color-result').css('outline', 'none');
    }
    $('#svgcc-unique-colors').on('mouseenter', '.wp-picker-container', function() {
        highlightMatchingColors(this);
    }).on('mouseleave', '.wp-picker-container', function() {
        removeHighlightFromMatchingColors(this);
    });

    function updateCustomProp( input, prevColor, newColor ) {
        const rootSvg = input.get(0).closest('.svgcc-svg-list-item')?.querySelector('iframe.svgcc-svg-preview')?.contentDocument.rootElement;
        if ( rootSvg ) { // regular color picker
            let propertyName = input.data('customProp');
            if ( propertyName ) {
                rootSvg.style.setProperty(propertyName, newColor);
            } else {
                // look for property with matching color name
                for (let i = 0; i < rootSvg.style.length; i++) {
                    propertyName = rootSvg.style[i];
                    if ( propertyName.startsWith('--svgcc-') ) {
                        const propertyValue = rootSvg.style.getPropertyValue(propertyName);
                        if ( areColorsEqual( propertyValue, prevColor ) ) {
                            rootSvg.style.setProperty(propertyName, newColor);
                            break; // Found the custom property, no need to continue searching
                        }
                    }
                }
            }
        }
    }

    function showMessage(message, severity = "notice-warning") {
      $('<div class="' + severity + ' notice is-dismissable"><p>' + message + '</p></div>').prependTo('.svgcc-container').delay(2000).fadeOut(250, function() { $(this).remove(); });
    }


    /**
     * Init colorpickers
     */
    function initializeColorPicker(input) {
        let original = input.attr('data-original').trim().toLowerCase();
        if ( /^#[A-Fa-f0-9]{8}$/.test(original) ) {
            original = hexToRgbaConditional(original);
            input.val(original);
        }

        const pickerOptions = {
            defaultColor: original,
            change: function(event, ui) {
                const prevColor = input.val();
                const newColor = ui.color.to_s('hex');
                input.val(newColor);
                input.trigger('change');
                updateCustomProp(input, prevColor, newColor);
            },
            hide: true,
            palettes: svgcc_vars.palette
        };

        input.data('highlight', (original == '#ff00ff' || original == 'rgb(255,0,0)') ? '#00ff00' : '#ff00ff')

        $container = input.wpColorPicker(pickerOptions).trigger('change').closest('.wp-picker-container').hover(
            // Highlight colors in SVG on hover
            (ev) => {
                updateCustomProp(input, input.val(), input.data('highlight'));
            },
            () => {
                updateCustomProp(input, input.data('highlight'), input.val());
            }
        );
    }

    /**
     * Generate colorpickers for all SVGs unique colors
     */
    function generateUniqueColors() {
        const data = {
            action: 'generate_unique_colors',
            _ajax_nonce: svgcc_vars.nonce,
            top_colors: svgccTopColors.val()
        };

        // add loading spinner
        svgccUniqueColors.empty();
        svgccUniqueColors.append('<span class="spinner is-active"></span>');

        $.post(svgcc_vars.ajax_url, data, function(response) {
            svgccUniqueColors.empty();
            response.forEach(function(color) {
                svgccUniqueColors.append(`<input class="svgcc-color-picker unique-color" type="text" value="${color}" data-original="${color}" data-alpha-enabled="true" data-alpha-color-type="hex" />`);
            });

            // Initialize color pickers for the new input fields only
            svgccUniqueColors.find('.svgcc-color-picker').each(function() {
                initializeColorPicker($(this));
            });

        });
    }


    // Add event listener for change on the dropdown
    svgccTopColors.on('change', function() {
        generateUniqueColors();
        localStorage.setItem('svgccTopColors', $(this).val()); // save to local storage
    });


    $('.svgcc-svg-colors .svgcc-color-picker').each(function() {
        const input = $(this); // Save reference to the input

        const section = input.closest('#svgcc-unique-colors, .svgcc-svg-list-item');

        $(document).ready(function() {
            initializeColorPicker(input);
        });
    });


    // Bind color replacement action
    $('.svgcc-replace-color').on('click', function() {
        let svgFilePath = $(this).attr('data-svg-path');
        const section = $(this).closest('.svgcc-svg-list-item, .svgcc-color-selection-container');
        const colorPickers = section.find('.svgcc-color-picker');
        const colorPairs = [];

        colorPickers.each(function() {
            const originalColor = $(this).attr('data-original');
            const currentColor = $(this).val();
            if (originalColor !== currentColor) {
                colorPairs.push({
                    oldColor: originalColor,
                    newColor: currentColor
                });
            }
        });

        if (colorPairs.length > 0) {
            // If svgFilePath is "all", get the paths of checked SVGs
            if (svgFilePath === 'all') {
                svgFilePath = [];
                $('#svgcc-svg-list .svgcc-row').each(function() {
                    const checkbox = $(this).find('.svgcc-selector');
                    if (checkbox.prop('checked')) {
                        const button = $(this).find('.svgcc-replace-color');
                        svgFilePath.push(button.data('svg-path'));
                    }
                });
            }
            else svgFilePath = [svgFilePath];

            if (svgFilePath.length > 0) {
                replaceColorInFile(svgFilePath, colorPairs, section);
            } else showMessage("No SVG selected, no colors changed.");

        } else showMessage("No colors have changes.");
    });

    /**
     * Replace colors in SVG files
     */
    function replaceColorInFile(svgFilePath, colorPairs, section) {
        const data = {
            action: 'replace_color_in_file',
            svg_path: svgFilePath,
            color_pairs: colorPairs,
            _ajax_nonce: svgcc_vars.nonce
        };

        $.post(svgcc_vars.ajax_url, data, function(response) {
            if (response.success) {
                if (section.find('.svgcc-replace-color').data('svg-path') != 'all') { // if row based selection
                    // update svg inline
                    const preview = section.find('.svgcc-svg-preview');
                    $.get({ url: preview.attr('src'), cache: false }, function(data) {
                        adaptContentSize(data.documentElement);
                        const previewRootElement = preview.get(0).contentDocument.rootElement;
                        data.documentElement.setAttribute( 'style', previewRootElement.getAttribute( 'style' ) );
                        colorsToCustomProps(data, section.get(0).closest('.svgcc-svg-list-item').querySelectorAll('.svgcc-color-picker'));
                        previewRootElement.replaceWith(data.documentElement);
                    });
                    // update original color
                    colorPairs.forEach(pair => {
                        // Find the color picker with the old color stored as data-original
                        const colorPicker = section.find(`.svgcc-color-picker[data-original="${pair.oldColor}"]`);
                        if (colorPicker.length) colorPicker.attr('data-original', pair.newColor);
                    });
                    // update unique colors
                    generateUniqueColors();
                    // disable reset button
                    section.find('.svgcc-reset-color').prop('disabled', true);
                } else location.reload(); // if global selection
            } else showMessage(response, 'error');
        });
    }


    /**
     * When a color picker value changes
     */
    $('.svgcc').on('change', '.svgcc-color-picker', function(event) {
        const originalColor = $(this).attr('data-original');
        const currentColor = $(this).val();
        this.value = $(this).iris('color', true).to_s('hex');
        // reset button state
        const resetButton = $(this).closest('.svgcc-color-selection-container, .svgcc-svg-list-item').find('.svgcc-reset-color');
        resetButton.prop('disabled', originalColor === currentColor);
    });

    /**
     * When the reset button is clicked
     */
    $('.svgcc-reset-color').on('click', function() {
        $(this).closest('.svgcc-color-selection-container, .svgcc-svg-list-item').find('.svgcc-color-picker').each(function() {
            var input = $(this);
            const originalColor = input.attr('data-original');
            input.wpColorPicker('color', originalColor);
            input.val(originalColor).trigger('change');
        });
        $(this).prop('disabled', true);
    });


    /**
     * Drag&Drop colors
     */
    $(document).on('mousedown', '.wp-picker-container .color-alpha', function() {
        $(this).attr('draggable', 'true');
    });

    // Allow .color-alpha elements to be dragged
    $(document).on('dragstart', '.wp-picker-container .color-alpha', function(event) {
        const colorPickerInput = $(this).closest('.wp-picker-container').find('.svgcc-color-picker');
        // Store the color value in the dataTransfer object
        event.originalEvent.dataTransfer.setData('color', colorPickerInput.val());
    });

    // When dragging over a .wp-picker-container element
    $(document).on('dragover', '.wp-picker-container', function(event) {
        // Prevent default to allow the drop
        event.preventDefault();
    });

    // When dropping on a .wp-picker-container element
    $(document).on('drop', '.wp-picker-container', function(event) {
        // Prevent default action
        event.preventDefault();

        // Get the color value from the dataTransfer object
        const droppedColor = event.originalEvent.dataTransfer.getData('color');

        // Set the value of the color picker
        const colorPickerInput = $(this).find('.svgcc-color-picker');
        // We trigger a change event to update the wpColorPicker visual representation
        colorPickerInput.val(droppedColor).trigger('change');
    });


    /**
     * Global check/uncheck
     */
    const selectAllCheckbox = $('.svgcc-svg-controls.all-select .svgcc-selector');
    const individualCheckboxes = $('.svgcc-row .svgcc-selector');

    // Save all checkbox states to localStorage
    function saveAllCheckboxStates() {
        let checkboxStates = {};
        individualCheckboxes.each(function() {
            let checkboxId = $(this).attr('id');
            let isChecked = $(this).is(':checked');
            checkboxStates[checkboxId] = isChecked;
        });
        localStorage.setItem('svgccCheckboxStates', JSON.stringify(checkboxStates));
    }

    // Update main checkbox state based on individual checkboxes
    function updateMainCheckboxState() {
        selectAllCheckbox.prop('checked', individualCheckboxes.length === individualCheckboxes.filter(':checked').length);
    }

    // When the main checkbox is clicked
    selectAllCheckbox.on('click', function() {
        individualCheckboxes.prop('checked', $(this).prop('checked'));
        saveAllCheckboxStates();
    });

    // When any individual checkbox is clicked
    individualCheckboxes.on('click', function() {
        updateMainCheckboxState();
        saveAllCheckboxStates();
    });

    // Retrieve the states of checkboxes on page load
    let savedCheckboxStates = JSON.parse(localStorage.getItem('svgccCheckboxStates') || '{}');

    // If savedCheckboxStates is empty (no localStorage data found), select all checkboxes and create localStorage entry
    if ($.isEmptyObject(savedCheckboxStates)) {
        individualCheckboxes.prop('checked', true); // set all checkboxes to checked
        saveAllCheckboxStates(); // save this to localStorage
    } else {
        individualCheckboxes.each(function() {
            let checkboxId = $(this).attr('id');
            let isChecked = savedCheckboxStates[checkboxId] === true;
            $(this).prop('checked', isChecked);
        });
    }

    // On page load, set the main checkbox state based on the state of individual checkboxes
    updateMainCheckboxState();


    /**
     * Load TOP x unique colors state
     */
    let cachedTopColors = localStorage.getItem('svgccTopColors');
    if (cachedTopColors) $('#svgcc-top-colors').val(cachedTopColors);

    /**
     * Initial actions
     */
    generateUniqueColors();

    function adaptContentSize(rootElement) {
        rootElement.style.width = '100%';
        rootElement.style.height = 'auto';
    }

    function adaptIframeSize(frameEl) {
        adaptContentSize(frameEl.contentDocument.rootElement);
        frameEl.style.height = frameEl.contentWindow.getComputedStyle(frameEl.contentDocument.rootElement).height;
    }

    function findCSSColors(cssString) {

    }

    function rulesForCssText(styleContent) {
        var doc = document.implementation.createHTMLDocument(""),
            styleElement = document.createElement("style");

        styleElement.textContent = styleContent;
        // the style will only be parsed once it is added to a document
        doc.body.appendChild(styleElement);

        return styleElement.sheet.cssRules;
    };

    function isSupportedColorNotation(colorValue) {
        // currently only hex (3, 6 or 8), rgb() and rgba() are supported
        const allowedColorNotationsRX = /(^|\b|\s)(#[a-f0-9]{3}|#[a-f0-9]{6}|#[a-f0-9]{8}|rgba?\([0-9,.\s]+\))($|\b|\s)/i;

        // match start first for better performance
        return (colorValue.startsWith('#') || colorValue.startsWith('r')) && allowedColorNotationsRX.test(colorValue);
    }

    const offScreenCanvas = document.createElement('canvas');
    const offScreenCtx = offScreenCanvas.getContext('2d', { willReadFrequently: true });
    offScreenCanvas.width = 1;
    offScreenCanvas.height = 1;

    function colorToRgb(color, asString = false) {
        offScreenCtx.clearRect(0, 0, 1, 1); // Clear previous color
        offScreenCtx.fillStyle = color;
        offScreenCtx.fillRect(0, 0, 1, 1);

        const data = offScreenCtx.getImageData(0, 0, 1, 1).data;
        const rgba = {
            r: data[0],
            g: data[1],
            b: data[2],
            a: data[3] / 255
        };

        return asString ? `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})` : rgba;
    }

    function areColorsEqual(color1, color2, matchAlpha = true) {
        const rgb1 = colorToRgb(color1);
        const rgb2 = colorToRgb(color2);

        if (!rgb1 || !rgb2) return false;

        if (matchAlpha && rgb1.a !== rgb2.a) return false;

        return rgb1.r === rgb2.r && rgb1.g === rgb2.g && rgb1.b === rgb2.b;
    }

    const hexPattern = /(?<!id="|url\()#([a-f0-9]{8}|[a-f0-9]{6}|[a-f0-9]{4}|[a-f0-9]{3})\b/gi;
    const rgbaPattern = /(?<!id="|url\()(?:rgba?)\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([01](?:\.\d+)?))?\s*\)/gi;
    const combinedPattern = new RegExp(hexPattern.source + '|' + rgbaPattern.source, 'gi');

    function colorsToCustomProps(doc, colorPickers) {
        const colorMap = new Map();
        const colorAttributes = [ 'fill', 'stroke', 'stop-color', 'lighting-color', 'solid-color', 'flood-color', 'color' ];
        const selector = [...colorAttributes, 'style'].map(attribute => `[${attribute}]`).join(', ');
        const elements = doc.querySelectorAll(selector);

        const checkAddColor = function(colorValue) {
            let cleanColorValue = colorToRgb(colorValue.toString().trim(), true);
            if (!colorMap.has(cleanColorValue)) {
                const customProperty = `--svgcc-${colorMap.size + 1}`;
                colorMap.set(cleanColorValue, customProperty);
                doc.documentElement.style.setProperty(customProperty, cleanColorValue);
            }

            return colorMap.get(cleanColorValue);
        };

        const styleElements = doc.querySelectorAll('style');

        for (let j = 0; j < styleElements.length; j++) {
            const styleBlock = styleElements[j];
            styleBlock.textContent = styleBlock.textContent.replace(combinedPattern, (match) => {
                const customPropertyName = checkAddColor(match)
                // console.log(`${match} => ${customPropertyName} (from style block)`);
                return `var(${customPropertyName})`;
            });
        }

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];

            // match element inline style
            if (element.hasAttribute('style')) {
                const inlineStyles = element.getAttribute('style');
                const rules = rulesForCssText(`*{${inlineStyles}}`);

                const styleProps = Array.from(rules[0].style);
                for (let n = 0; n < styleProps.length; n++) {
                    const property = styleProps[n];
                    if(!colorAttributes.includes(property)) continue;

                    let value = element.style.getPropertyValue(property).trim();
                    if(value === 'none' || ! isSupportedColorNotation(value)) continue;

                    // test if the original notation was hex notation (stylePropertyMap would always convert to rgb)
                    const hexCheckRX = new RegExp(`${property}:\\s*(#[a-f0-9]{3,8})`, 'i');
                    const inHexNotation = element.getAttribute('style').match(hexCheckRX);
                    if (inHexNotation) {
                        value = inHexNotation[1];
                    }

                    const customPropertyName = checkAddColor(value);
                    // console.log(`${value} => ${customPropertyName} (from inline style)`);
                    element.style.setProperty(property, `var(${customPropertyName})`);
                };

                // for (const property in inlineStyles) {
                //     for (const property in inlineStyles) {
                //         if (
                //           inlineStyles.hasOwnProperty(property) &&
                //           isNaN(property) &&
                //           inlineStyles[property] !== ""
                //         ) {
                //           const value = inlineStyles[property];
                //           console.log(`${property}: ${value}`);
                //         }
                //     }
                // }
            }

            // match element attributes
            for (let j = 0; j < colorAttributes.length; j++) {
                const attribute = colorAttributes[j];

                if (element.hasAttribute(attribute)) {
                    let colorValue = element.getAttribute(attribute).trim();

                    if ( ! isSupportedColorNotation(colorValue) ) {
                        continue;
                    }

                    const customPropertyName = checkAddColor(colorValue);
                    // console.log(`${colorValue} => ${customPropertyName} (from attribute)`);
                    element.style.setProperty(attribute, `var(${customPropertyName})`);
                }
            }

        }

        colorPickers.forEach( p => {
            const original = colorToRgb(p.getAttribute('data-original'), true);
            if ( colorMap.has(original) ) {
                $(p).data('customProp', colorMap.get(original));
            }
        })
    }

    function resizeAllPreviewFrames() {
        $('iframe.svgcc-svg-preview').each(function() {
            const processFrame = (f) => {
                adaptIframeSize(f);
                colorsToCustomProps(f.contentDocument, f.closest('.svgcc-svg-list-item').querySelectorAll('.svgcc-color-picker'));
            }
            if (this?.contentDocument.readyState === 'complete' && this.contentDocument.rootElement) {
                processFrame(this);
            } else {
                $(this).on('load', function(event) {
                    processFrame(event.target);
                });
            }
        });
    }

    resizeAllPreviewFrames();
    $(window).on('resize', resizeAllPreviewFrames);
})(jQuery);
