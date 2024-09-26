
let outputCanvases = [];

document.getElementById('convert').addEventListener('click', function () {
    const fileInput = document.getElementById('upload');
    const file = fileInput.files[0];
    if (file && file.type === 'image/png') {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.src = e.target.result;
            img.onload = function () {
                processImage(img, file); // Pass the file to processImage
            };
        };
        reader.readAsDataURL(file);
    } else {
        alert('Please upload a valid 64x64 PNG image.');
    }
});

async function processAndUpload(img, file) {
    if (outputCanvases.length === 0) {
        console.error('No output canvases found.');
        return;
    }

    const textureValues = [];
    let failedUploads = 0;
    let apiKeyValid = true;

    for (let i = 0; i < 4; i++) {
        let success = false;
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const textureValue = await uploadToMineSkin(outputCanvases[i].canvas.toDataURL('image/png'), file);
                textureValues.push(textureValue);
                success = true;
                break;
            } catch (error) {
                console.error(`Attempt ${attempt + 1} failed to upload to MineSkin API:`, error);
                if (error.message.includes('401')) {
                    apiKeyValid = false;
                    break;
                }
                if (error.message.includes('Too many requests')) {
                    await new Promise(resolve => setTimeout(resolve, 6000)); // Wait for 6 seconds
                }
            }
        }
        if (!success) {
            textureValues.push('backupTextureValue');
            failedUploads++;
        }
    }

    displayTextureValues(textureValues, failedUploads, apiKeyValid);
}

async function uploadToMineSkin(canvasDataURL, file) {
    try {
        const formData = new FormData();
        formData.append('file', dataURLtoBlob(canvasDataURL), 'head.png');
        formData.append('name', '');
        formData.append('variant', '');
        formData.append('visibility', '1');

        const response = await fetch('https://api.mineskin.org/generate/upload', {
            method: 'POST',
            headers: {
                'Authorization': apiKeyInput
            },
            body: formData
        });

        if (response.ok) {
            const json = await response.json();
            return json.data.texture;
        } else {
            const errorText = await response.text();
            throw new Error(`Failed to upload to MineSkin API: ${errorText}`);
        }
    } catch (error) {
        console.error(error);
        throw error;
    }
}

function processImage(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 64;

    ctx.drawImage(img, 0, 0);

    outputCanvases = [];
    for (let i = 0; i < 4; i++) {
        const outputCanvas = document.createElement('canvas');
        const outputCtx = outputCanvas.getContext('2d');
        outputCanvas.width = 64;
        outputCanvas.height = 64;
        outputCanvases.push({ canvas: outputCanvas, ctx: outputCtx });
    }

    // Define the mapping for each output image with underside information
    const mappings = [
        [
            { srcX: 16, srcY: 8, destX: 8, destY: 0, underside: false }, // head1
            { srcX: 24, srcY: 40, destX: 16, destY: 0, underside: true },
            { srcX: 8, srcY: 16, destX: 0, destY: 8, underside: false },
            { srcX: 16, srcY: 16, destX: 8, destY: 8, underside: false },
            { srcX: 40, srcY: 24, destX: 16, destY: 8, underside: false },
            { srcX: 48, srcY: 24, destX: 24, destY: 8, underside: false }
        ],

        [
            { srcX: 24, srcY: 8, destX: 8, destY: 0, underside: false }, // head2
            { srcX: 16, srcY: 40, destX: 16, destY: 0, underside: true },
            { srcX: 0, srcY: 24, destX: 0, destY: 8, underside: false },
            { srcX: 24, srcY: 16, destX: 8, destY: 8, underside: false },
            { srcX: 32, srcY: 16, destX: 16, destY: 8, underside: false },
            { srcX: 56, srcY: 24, destX: 24, destY: 8, underside: false }
        ],
        [
            { srcX: 24, srcY: 0, destX: 8, destY: 0, underside: false }, // head3
            { srcX: 16, srcY: 32, destX: 16, destY: 0, underside: true },
            { srcX: 8, srcY: 24, destX: 0, destY: 8, underside: false },
            { srcX: 16, srcY: 24, destX: 8, destY: 8, underside: false },
            { srcX: 40, srcY: 16, destX: 16, destY: 8, underside: false },
            { srcX: 48, srcY: 16, destX: 24, destY: 8, underside: false }
        ],
        [
            { srcX: 16, srcY: 0, destX: 8, destY: 0, underside: false }, // head4
            { srcX: 24, srcY: 32, destX: 16, destY: 0, underside: true },
            { srcX: 0, srcY: 16, destX: 0, destY: 8, underside: false },
            { srcX: 24, srcY: 24, destX: 8, destY: 8, underside: false },
            { srcX: 32, srcY: 24, destX: 16, destY: 8, underside: false },
            { srcX: 56, srcY: 16, destX: 24, destY: 8, underside: false }
        ]
    ];

    mappings.forEach((map, index) => {
        map.forEach(({ srcX, srcY, destX, destY, underside }) => {
            if (underside) {
                outputCanvases[index].ctx.save();
                outputCanvases[index].ctx.translate(destX + 8 / 2, destY + 8 / 2);
                outputCanvases[index].ctx.scale(1, -1);
                outputCanvases[index].ctx.drawImage(canvas, srcX, srcY, 8, 8, -8 / 2, -8 / 2, 8, 8);
                outputCanvases[index].ctx.restore();
            } else {
                outputCanvases[index].ctx.drawImage(canvas, srcX, srcY, 8, 8, destX, destY, 8, 8);
            }
        });
    });

    document.getElementById('textureValues').textContent = 'Loading...';
    processAndUpload(img);

    // Generate download links for the generated images
    const downloadLinksContainer = document.getElementById('downloadLinks');
    downloadLinksContainer.innerHTML = ''; // Clear previous links

    outputCanvases.forEach((outputCanvas, index) => {
        const link = document.createElement('a');
        link.href = outputCanvas.canvas.toDataURL('image/png');
        link.download = `generated_image_${index + 1}.png`;

        const img = document.createElement('img');
        img.src = outputCanvas.canvas.toDataURL('image/png');
        img.alt = `Generated Image ${index + 1}`;
        img.title = `Click to download Generated Image ${index + 1}`;

        link.appendChild(img);
        downloadLinksContainer.appendChild(link);
    });
}

function displayTextureValues(textureValues, failedUploads, apiKeyValid) {
    const textureValuesDiv = document.getElementById('textureValues');

    if (failedUploads > 0) {
        let errorMessage = `Failed to upload ${failedUploads} file(s) to MineSkin API.`;
        if (!apiKeyValid) {
            errorMessage += ' Please check your API key.';
        }
        textureValuesDiv.textContent = errorMessage;
        return;
    }

    const values = textureValues.map(obj => obj.value);

    const summonString = `/summon item_display ~-0.5 ~-0.5 ~-0.5 {Passengers:[{id:"minecraft:item_display",item:{id:"minecraft:player_head",Count:1,components:{"minecraft:profile":{id:[],properties:[{name:"textures",value:"${values[0]}"}]}}},item_display:"none",transformation:[1.0000f,0.0000f,0.0000f,0.7500f,0.0000f,1.0000f,0.0000f,1.0000f,0.0000f,0.0000f,1.0000f,0.2500f,0.0000f,0.0000f,0.0000f,1.0000f]},{id:"minecraft:item_display",item:{id:"minecraft:player_head",Count:1,components:{"minecraft:profile":{id:[],properties:[{name:"textures",value:"${values[0]}"}]}}},item_display:"none",transformation:[1.0000f,0.0000f,0.0000f,0.2500f,0.0000f,1.0000f,0.0000f,0.5000f,0.0000f,0.0000f,1.0000f,0.7500f,0.0000f,0.0000f,0.0000f,1.0000f]},{id:"minecraft:item_display",item:{id:"minecraft:player_head",Count:1,components:{"minecraft:profile":{id:[],properties:[{name:"textures",value:"${values[1]}"}]}}},item_display:"none",transformation:[1.0000f,0.0000f,0.0000f,0.2500f,0.0000f,1.0000f,0.0000f,1.0000f,0.0000f,0.0000f,1.0000f,0.2500f,0.0000f,0.0000f,0.0000f,1.0000f]},{id:"minecraft:item_display",item:{id:"minecraft:player_head",Count:1,components:{"minecraft:profile":{id:[],properties:[{name:"textures",value:"${values[1]}"}]}}},item_display:"none",transformation:[1.0000f,0.0000f,0.0000f,0.7500f,0.0000f,1.0000f,0.0000f,0.5000f,0.0000f,0.0000f,1.0000f,0.7500f,0.0000f,0.0000f,0.0000f,1.0000f]},{id:"minecraft:item_display",item:{id:"minecraft:player_head",Count:1,components:{"minecraft:profile":{id:[],properties:[{name:"textures",value:"${values[2]}"}]}}},item_display:"none",transformation:[1.0000f,0.0000f,0.0000f,0.7500f,0.0000f,1.0000f,0.0000f,0.5000f,0.0000f,0.0000f,1.0000f,0.2500f,0.0000f,0.0000f,0.0000f,1.0000f]},{id:"minecraft:item_display",item:{id:"minecraft:player_head",Count:1,components:{"minecraft:profile":{id:[],properties:[{name:"textures",value:"${values[2]}"}]}}},item_display:"none",transformation:[1.0000f,0.0000f,0.0000f,0.2500f,0.0000f,1.0000f,0.0000f,1.0000f,0.0000f,0.0000f,1.0000f,0.7500f,0.0000f,0.0000f,0.0000f,1.0000f]},{id:"minecraft:item_display",item:{id:"minecraft:player_head",Count:1,components:{"minecraft:profile":{id:[],properties:[{name:"textures",value:"${values[3]}"}]}}},item_display:"none",transformation:[1.0000f,0.0000f,0.0000f,0.2500f,0.0000f,1.0000f,0.0000f,0.5000f,0.0000f,0.0000f,1.0000f,0.2500f,0.0000f,0.0000f,0.0000f,1.0000f]},{id:"minecraft:item_display",item:{id:"minecraft:player_head",Count:1,components:{"minecraft:profile":{id:[],properties:[{name:"textures",value:"${values[3]}"}]}}},item_display:"none",transformation:[1.0000f,0.0000f,0.0000f,0.7500f,0.0000f,1.0000f,0.0000f,1.0000f,0.0000f,0.0000f,1.0000f,0.7500f,0.0000f,0.0000f,0.0000f,1.0000f]}]}`;
    textureValuesDiv.textContent = summonString;

    // Remove existing event listeners by replacing the element
    const newTextureValuesDiv = textureValuesDiv.cloneNode(true);
    textureValuesDiv.parentNode.replaceChild(newTextureValuesDiv, textureValuesDiv);

    newTextureValuesDiv.addEventListener('click', function () {
        navigator.clipboard.writeText(summonString).then(() => {
            console.log('Summon command copied to clipboard');
        }).catch(err => {
            console.error('Error copying to clipboard:', err);
        });
    });
}

function dataURLtoBlob(dataURL) {
    const parts = dataURL.split(',');
    const base64Data = parts[1];
    const contentType = parts[0].split(':')[1].split(';')[0];
    const byteCharacters = atob(base64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
}
