export function HeroCopySection(): JSX.Element {
  return (
    <div className="relative mx-auto mt-6 flex w-full max-w-[min(1184px,calc(100%-2rem))] flex-col items-center gap-4 px-4 text-center sm:mt-8 sm:gap-5 md:mt-10 md:px-6 lg:mt-[clamp(3rem,8vw,11.5rem)]">
      <p className="relative mt-[-1px] max-w-[min(1184px,100%)] bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text font-display font-bold text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-fill-color:transparent] text-[clamp(1.375rem,4.2vw,3rem)] leading-[1.1] tracking-[0]">
        Управление отходами по ФККО, контроль объектов и маршрутов на одной карте
      </p>

      <p className="relative max-w-[min(754px,100%)] font-nunito font-semibold text-[#747b7d] text-[clamp(1rem,2.2vw,1.25rem)] leading-normal tracking-[0]">
        Фильтруйте по ФККО, виду обращения и региону. Планируйте экологическую инфраструктуру в реальном времени.
      </p>
    </div>
  );
}
