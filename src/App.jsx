import React, { useState, useEffect } from 'react'

const API_PREFIX = '/api'

export default function App() {
  const [files, setFiles] = useState([])
  const [currentPath, setCurrentPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [spaceWarning, setSpaceWarning] = useState(false)
  const [passwordPrompt, setPasswordPrompt] = useState(false)
  const [password, setPassword] = useState('')
  const [totalUsed, setTotalUsed] = useState(0)
  const [pendingFiles, setPendingFiles] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')

  const LIMIT = 10 * 1024 * 1024 * 1024 // 10GB

  // 获取文件列表
  const fetchFiles = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_PREFIX}/list?path=${encodeURIComponent(currentPath)}`)
      const data = await response.json()
      setFiles(data.files || [])
      setTotalUsed(data.totalUsed || 0)
    } catch (error) {
      console.error('获取文件列表失败:', error)
      alert('获取文件列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [currentPath])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(''), 2400)
    return () => clearTimeout(timer)
  }, [successMessage])

  // 路径导航
  const navigateTo = (path) => {
    setCurrentPath(path)
    setUploadProgress(0)
  }

  const goBack = () => {
    const parts = currentPath.split('/').filter(p => p)
    if (parts.length > 0) {
      parts.pop()
      navigateTo(parts.join('/'))
    }
  }

  const goRoot = () => {
    navigateTo('')
  }

  // 计算新增文件大小
  const calculateFileSize = (files) => {
    let total = 0
    for (const file of files) {
      if (file.webkitGetAsEntry) {
        // 文件夹或文件
        const item = file.webkitGetAsEntry()
        if (item?.isFile) {
          total += file.size
        }
      } else {
        total += file.size
      }
    }
    return total
  }

  // 处理上传
  const handleUpload = async (fileList, pathPrefix = '') => {
    if (fileList.length === 0) return

    let newSize = 0
    const allFilesToUpload = []

    // 递归收集所有文件
    const processItems = async (items) => {
      for (const item of items) {
        if (item.isFile) {
          const file = await new Promise(resolve => item.file(resolve))
          allFilesToUpload.push({
            file,
            path: pathPrefix + (pathPrefix ? '/' : '') + file.name
          })
          newSize += file.size
        } else if (item.isDirectory) {
          const reader = item.createReader()
          const children = await new Promise(resolve => reader.readEntries(resolve))
          await processItems(children)
        }
      }
    }

    // 如果是 DataTransfer 列表
    if (fileList[0]?.webkitGetAsEntry) {
      const entries = Array.from(fileList).map(f => f.webkitGetAsEntry())
      await processItems(entries)
    } else {
      // 普通文件列表
      for (const file of fileList) {
        allFilesToUpload.push({
          file,
          path: pathPrefix + (pathPrefix ? '/' : '') + file.name
        })
        newSize += file.size
      }
    }

    // 检查空间
    if (totalUsed + newSize > LIMIT) {
      setPendingFiles(allFilesToUpload)
      setPasswordPrompt(true)
      return
    }

    await uploadFiles(allFilesToUpload)
  }

  // 上传文件到后端
  const uploadFiles = async (filesToUpload) => {
    setUploading(true)
    setUploadProgress(0)

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const { file, path } = filesToUpload[i]
        const formData = new FormData()
        formData.append('file', file)
        formData.append('path', currentPath ? currentPath + '/' + path : path)

        // 添加密码（如果需要）
        if (passwordPrompt && password) {
          formData.append('password', password)
        }

        const response = await fetch(`${API_PREFIX}/upload`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`上传失败: ${response.statusText}`)
        }

        setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 100))
      }

      setSuccessMessage('上传成功')
      setPassword('')
      setPasswordPrompt(false)
      setPendingFiles(null)
      fetchFiles()
    } catch (error) {
      console.error('上传错误:', error)
      alert('上传失败: ' + error.message)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  // 处理密码验证上传
  const handlePasswordUpload = async () => {
    if (!password) {
      alert('请输入密码')
      return
    }

    try {
      // 验证密码
      const response = await fetch(`${API_PREFIX}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (!response.ok) {
        alert('密码错误')
        return
      }

      await uploadFiles(pendingFiles)
    } catch (error) {
      alert('验证失败: ' + error.message)
    }
  }

  // 删除文件
  const handleDelete = async (fileName) => {
    if (!confirm('确定要删除此文件吗？')) return

    try {
      const response = await fetch(`${API_PREFIX}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentPath ? currentPath + '/' + fileName : fileName
        })
      })

      if (!response.ok) {
        throw new Error('删除失败')
      }

      alert('删除成功')
      fetchFiles()
    } catch (error) {
      alert('删除失败: ' + error.message)
    }
  }

  // 下载文件
  const handleDownload = (fileName) => {
    const path = currentPath ? currentPath + '/' + fileName : fileName
    window.location.href = `${API_PREFIX}/download?path=${encodeURIComponent(path)}`
  }

  // 进入文件夹
  const enterFolder = (folderName) => {
    const newPath = currentPath ? currentPath + '/' + folderName : folderName
    navigateTo(newPath)
  }

  // 拖拽处理
  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!uploading) {
      handleUpload(e.dataTransfer.items || e.dataTransfer.files)
    }
  }

  // 点击选择文件
  const handleFileSelect = (e) => {
    if (e.target.files.length > 0) {
      handleUpload(e.target.files)
      e.target.value = ''
    }
  }

  // 点击选择文件夹
  const handleFolderSelect = (e) => {
    if (e.target.files.length > 0) {
      handleUpload(e.target.files)
      e.target.value = ''
    }
  }

  // 分离文件夹和文件
  const folders = files.filter(f => f.isDirectory).sort((a, b) => a.name.localeCompare(b.name))
  const regularFiles = files.filter(f => !f.isDirectory).sort((a, b) => a.name.localeCompare(b.name))

  // 格式化文件大小
  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // 格式化日期
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-CN')
  }

  return (
    <div className="app" onDragOver={handleDragOver} onDrop={handleDrop}>
      {successMessage && (
        <div className="toast toast-success" role="status" aria-live="polite">
          {successMessage}
        </div>
      )}

      <header className="header">
        <h1>📁 临时网盘</h1>
        <p className="space-info">
          已用: {formatSize(totalUsed)} / {formatSize(LIMIT)}
          <span className={`space-bar ${totalUsed > LIMIT * 0.8 ? 'warning' : ''}`}>
            <span style={{ width: Math.min(100, (totalUsed / LIMIT) * 100) + '%' }}></span>
          </span>
        </p>
      </header>

      <nav className="breadcrumb">
        <button onClick={goRoot}>首页</button>
        {currentPath.split('/').filter(p => p).map((part, idx, arr) => (
          <React.Fragment key={idx}>
            <span> / </span>
            <button onClick={() => navigateTo(arr.slice(0, idx + 1).join('/'))}>{part}</button>
          </React.Fragment>
        ))}
        {currentPath && <button onClick={goBack} style={{ marginLeft: '10px' }}>← 返回上一级</button>}
      </nav>

      <div className="upload-area">
        <div className="upload-box">
          <p className="drop-hint">🖱️ 拖拽文件到此上传</p>
          <div className="button-group">
            <label className="file-input-label">
              📄 选择文件
              <input type="file" onChange={handleFileSelect} multiple disabled={uploading} />
            </label>
            <label className="folder-input-label">
              📁 选择文件夹
              <input type="file" directory="" onChange={handleFolderSelect} webkitdirectory="" disabled={uploading} />
            </label>
          </div>
          {uploading && (
            <div className="progress-bar">
              <div className="progress" style={{ width: uploadProgress + '%' }}></div>
              <span className="progress-text">{uploadProgress}%</span>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        <div className="file-list">
          {folders.length === 0 && regularFiles.length === 0 ? (
            <p className="empty">点击上方按钮或拖拽文件上传</p>
          ) : (
            <>
              {folders.map(folder => (
                <div key={folder.name} className="file-item folder-item">
                  <div className="file-info" onClick={() => enterFolder(folder.name)}>
                    <span className="file-name">📁 {folder.name}</span>
                  </div>
                </div>
              ))}
              {regularFiles.map(file => (
                <div key={file.name} className="file-item">
                  <div className="file-info">
                    <span className="file-name">📄 {file.name}</span>
                    <span className="file-size">{formatSize(file.size)}</span>
                    <span className="file-date">{formatDate(file.uploaded)}</span>
                  </div>
                  <div className="file-actions">
                    <button onClick={() => handleDownload(file.name)} className="btn-download">⬇️ 下载</button>
                    <button onClick={() => handleDelete(file.name)} className="btn-delete">🗑️ 删除</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {passwordPrompt && (
        <div className="modal-overlay" onClick={() => { setPasswordPrompt(false); setPassword('') }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>空间不足需要密码</h2>
            <p>文件总大小将超过 10GB 免费额度，需要输入密码才能上传。</p>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
              onKeyPress={e => e.key === 'Enter' && handlePasswordUpload()}
            />
            <div className="modal-buttons">
              <button onClick={handlePasswordUpload} className="btn-confirm">上传</button>
              <button onClick={() => { setPasswordPrompt(false); setPassword('') }} className="btn-cancel">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
