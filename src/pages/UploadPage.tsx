import { useId, useState } from 'react';
import pdfPlaceholderIcon from '@/assets/upload/pdf-placeholder.svg';

export default function UploadPage(): JSX.Element {
  const fileInputId = useId();
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');

  const handleDragEnter = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const relatedTarget = event.relatedTarget as Node | null;
    if (!event.currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFileName(file.name);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFileName(file ? file.name : '');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLLabelElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const input = document.getElementById(fileInputId) as HTMLInputElement | null;
      input?.click();
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center">
      <label
        htmlFor={fileInputId}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        className={`flex w-full max-w-[920px] cursor-pointer flex-col items-center gap-9 rounded-[32px] px-9 py-12 transition-transform duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${
          isDragOver ? 'scale-[1.01]' : ''
        }`}
        aria-describedby="upload-description upload-status"
      >
        <input
          id={fileInputId}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={handleFileChange}
        />
        <div className="flex h-[136px] w-[136px] items-center justify-center rounded-full border border-white/70 bg-white/40 backdrop-blur-xl">
          <img
            className="h-14 w-[49px]"
            alt=""
            aria-hidden="true"
            src={pdfPlaceholderIcon}
          />
        </div>
        <div className="flex w-full max-w-[781px] flex-col items-center gap-6">
          <p
            id="upload-title"
            className="typo-h4 bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-center text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-fill-color:transparent]"
          >
            {selectedFileName || 'перетащите сюда лицензию в pdf'}
          </p>
          <p id="upload-description" className="text-center font-['Nunito-SemiBold',Helvetica] text-lg font-semibold text-[#5e6567]">
            или нажмите, чтобы выбрать файл
          </p>
          <p id="upload-status" className="sr-only" aria-live="polite">
            {selectedFileName
              ? `Выбран файл ${selectedFileName}`
              : isDragOver
                ? 'Отпустите файл, чтобы загрузить PDF'
                : 'Зона загрузки PDF файла'}
          </p>
        </div>
      </label>
    </div>
  );
}
