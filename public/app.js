document.addEventListener("DOMContentLoaded", function(event) {
    let BaseData = {}
    let BaseKey = null
    let doingDownload = false
    let fileNumber = 0
    
    if (window.location.hash) {
      BaseData = JSON.parse(atob(window.location.hash.substring(1)))
      BaseKey = new window._bitcoinjsLib.ECPair(window._bigi.fromHex(BaseData["key"]))
    } else {
      //generate a random base key
      BaseKey = window._bitcoinjsLib.ECPair.makeRandom()
      BaseData = {"key": BaseKey.d.toBuffer(32).toString("hex")}
    }
    let shareLink = window.location.href.split("#")[0] + "#" + btoa(JSON.stringify(BaseData))

    let dropArea = document.getElementById("upload")
    let fileListing = document.getElementById("files")

    // Prevent default drag behaviors
    ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, preventDefaults, false)   
      document.body.addEventListener(eventName, preventDefaults, false)
    })

    // Highlight drop area when item is dragged over it
    ;['dragenter', 'dragover'].forEach(eventName => {
      dropArea.addEventListener(eventName, highlight, false)
    })

    ;['dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, unhighlight, false)
    })

    // Handle dropped files
    dropArea.addEventListener('drop', handleDrop, false)
    let uploadProgress = []
    let progressBar = document.getElementById('progress-bar')

    function preventDefaults (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    function highlight(e) {
      dropArea.classList.add('highlight')
    }

    function unhighlight(e) {
      dropArea.classList.remove('active')
    }

    function handleDrop(e) {
      var dt = e.dataTransfer
      var files = dt.files

      handleFiles(files)
    }


    function initializeProgress(numFiles) {
      progressBar.value = 0
      uploadProgress = []

      for(let i = numFiles; i > 0; i--) {
        uploadProgress.push(0)
      }
    }

    function updateProgress(fileNumber, percent) {
      uploadProgress[fileNumber] = percent
      let total = uploadProgress.reduce((tot, curr) => tot + curr, 0) / uploadProgress.length
      //update the progress bar ...
      console.log(fileNumber)
      console.log(document.getElementById("files").children[fileNumber])
      let text = document.getElementById("files").children[fileNumber].children[0].children[1]
      let status = text.children[0]
      let progress = text.children[1]
      
      if (percent >= 100) {
        //set to 100% and completed
        status.innerHTML += '<p>Complete <i class="fa fa-check check" aria-hidden="true"></i></p>'
        progress.innerHTML = ''
      } else {
        //update the percentages
        let prog = mE("progress", "progressOrange")
        prog.max = 100
        prog.value = percent
        progress.innerHTML = ''
        progress.appendChild(prog)
      }
      
      console.log(progress)
      
      //<div class="progressOrange first-progress"></div>
      //<div class="progressGreen first-progress"></div>
      
//      progressBar.value = total
    }

    function handleFiles(files) {
      files = [...files]
//      initializeProgress(files.length)
      files.forEach(uploadFile)
      files.forEach(previewFile)
    }

    function previewFile(file) {
      {
        let d = document.createElement('div')
        d.innerHTML = file.name + " " + file.size + " " + file.type
        //img.src = reader.result
        //document.getElementById('gallery').appendChild(d)
      }
    }

    function downloadChunk(idx, counter) {
      let hdnode = new window._bitcoinjsLib.HDNode(BaseKey, new window._buffer.Buffer("a".repeat(256/8)))
      hdnode = hdnode.deriveHardened(idx)
      hdnode = hdnode.deriveHardened(counter)
      let privKeyHex = hdnode.keyPair.d.toBuffer(32).toString("hex")
      window.localStorage.setItem("blockstack", JSON.stringify({appPrivateKey: privKeyHex}))
      return blockstack.getFile("f" + idx + "_" + counter)
    }

    async function uploadChunk(idx, counter, data) {
      let hdnode = new window._bitcoinjsLib.HDNode(BaseKey, new window._buffer.Buffer("a".repeat(256/8)))
      hdnode = hdnode.deriveHardened(idx)
      hdnode = hdnode.deriveHardened(counter)
      let privKeyHex = hdnode.keyPair.d.toBuffer(32).toString("hex")
      window.localStorage.setItem("blockstack", JSON.stringify({appPrivateKey: privKeyHex}))
      console.log("uploading chunk of sz "  + data.length)
      await blockstack.putFile("f" + idx + "_" + counter, data, {encrypt: false} ).then( () => {
        //
      })
    }
    
    function updateShareLink() {
      shareLink = window.location.href.split("#")[0] + "#" + btoa(JSON.stringify(BaseData))
      let link = document.createElement('a')
      link.href = shareLink
      link.innerHTML = "click to copy"
      document.getElementById('share_link').innerHTML = "Share: ";
      document.getElementById('share_link').appendChild(link)
    }
    function updateManifest(idx, filename, size, chunks, type) {
      
      //fix up chunks
      if (chunks.toFixed() != chunks) {
        chunks = (chunks+1).toFixed()
      }
      
      //update the file manifest
      if (!BaseData["manifest"]) {
        BaseData["manifest"] = {}
      }
      BaseData["manifest"][idx] = [filename, size, chunks, type]
      updateShareLink()
    }

     function uploadFile(file, idx) {
      //do it in 2 MB chunks
      let chunkLimit = 2*1024*1024;
      
      updateManifest(fileNumber, file.name, file.size, file.size / chunkLimit, file.type)
      fileListing.appendChild(makeRowEntry(fileNumber, BaseData.manifest[fileNumber]))

      let reader = new FileReader()
      reader.__current = 0
      reader.__limit = file.size
      reader.__chunkSize = chunkLimit
      reader.__counter = 0
      reader.__fileNumber = fileNumber
      fileNumber += 1
      reader.readAsBinaryString(file.slice(reader.__current, reader.__current + chunkLimit))
      reader.onloadend = async function () {
        if (!this.result) {
          console.log("error?")
          console.log(this)
        } else {
          await uploadChunk(this.__fileNumber, this.__counter, btoa(this.result))
          this.__current += this.__chunkSize
          this.__counter += 1
          if (this.__current < this.__limit) {
            this.readAsBinaryString(file.slice(this.__current, this.__current + chunkLimit))
            updateProgress(this.__fileNumber, this.__current * 100.0 / this.__limit)
          } else {
            updateProgress(this.__fileNumber, 100)
          }
        }
      }


    }

    
    function b642ab(b64) {
      let raw = window.atob(b64);
      let rawLength = raw.length;
      let array = new Uint8Array(new ArrayBuffer(rawLength));
      for (var i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
      }
      return array
    }
    
    async function downloadFile(index) {
      //debounce
      if (doingDownload) return
      doingDownload = true

      filename = BaseData.manifest[index][0]
      file_size = BaseData.manifest[index][1]
      num_chunks = BaseData.manifest[index][2]
      file_type = BaseData.manifest[index][3]

      const fileStream = streamSaver.createWriteStream(filename)
      const writer = fileStream.getWriter()

      let s = 0
      let done = 0
      for (let i = 0; i < num_chunks; i++) {
        await downloadChunk(index, i).then( function(data) {
          let uint8array = b642ab(data)
          s += uint8array.length
          writer.write(uint8array)
          
        })
      }
      writer.close()
      doingDownload = false
    }
    
    function listFiles() {
      if (BaseData.manifest) {
        for (var i = 0; ; i++) {
          if (!BaseData.manifest[i]) break;
          let re = makeRowEntry(i, BaseData.manifest[i], true)
          re.__index = i
          re.onclick = function() {
            downloadFile(this.__index)
          }
          
          fileListing.appendChild(re)
        }
        dropArea.innerHTML = '<a href="">Click to start new upload</a>'
      } else {
        dropArea.style = ""
      }
    }
    
    function mE(type, classnames) {
      let div = document.createElement(type)
      div.className = classnames
      return div
    }

    function makeRowEntry(idx, file, finished) {
      let fname = file[0]
      let fsize = file[1]
      let ftype = file[3]
      
      let row_entry = mE("div", "files__row")
      let content =  mE("div", "content")
      let picture = mE("div", "picture")
      let icon = mE("i", 'fas fa-file-image fa-3x aria-hidden="true"')
      picture.appendChild(icon)
      content.appendChild(picture)
      
      
      let text = mE("div", "text")
      let status = mE("div", "status")
      let sz = ""
      if (fsize < 1024*1024) {
        sz = (fsize / 1024)
        sz = Math.round(sz*100)/100  + "KB"
      } else if (fsize < 1024*1024*1024) {
        sz = (fsize / 1024 / 1024) 
        sz = Math.round(sz*100)/100 + "MB"
      } else {
        sz = (fsize / 1024 / 1024 / 1024)    
        sz = Math.round(sz*100)/100  + "GB"
      }
      
      let finishText = ""
      if (finished) {
        finishText = '  <p>Complete <i class="fa fa-check check" aria-hidden="true"></i></p>'
        fname = '<a href="javascript:window.app.downloadFile('+idx+')">' + fname + "</a>"
      }
      status.innerHTML = '<span>' + fname + ' - ' + sz + '</span>' + finishText
      text.appendChild(status)
      content.appendChild(text)
      
      let progressbar = mE("div", "progressBar")
      let greenbar = mE("div", "progressGreen")
      progressbar.appendChild(greenbar)
      text.appendChild(progressbar)
      
      let bar = document.createElement("div")
      bar.className = "bar"
      row_entry.appendChild(content)
      row_entry.appendChild(bar)
      return row_entry;
    }

    listFiles()
    window.app = {}
    window.app.handleFiles = handleFiles
    window.app.downloadFile = downloadFile
})
