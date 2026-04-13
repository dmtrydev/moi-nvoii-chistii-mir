import image from '@/assets/map-screen/image.svg';
import polygon2 from '@/assets/map-screen/polygon-2.svg';
import polygon22 from '@/assets/map-screen/polygon-2-2.svg';
import polygon23 from '@/assets/map-screen/polygon-2-3.svg';
import polygon3 from '@/assets/map-screen/polygon-3.svg';
import vector from '@/assets/map-screen/vector.svg';
import vector2 from '@/assets/map-screen/vector-2.svg';
import vector3 from '@/assets/map-screen/vector-3.svg';
import vector4 from '@/assets/map-screen/vector-4.svg';
import vector5 from '@/assets/map-screen/vector-5.svg';
import vector6 from '@/assets/map-screen/vector-6.svg';
import vector7 from '@/assets/map-screen/vector-7.svg';

export const FilterManagementSidebarSection = (): JSX.Element => {
  return (
    <div className="absolute top-[95px] left-5 w-[619px] h-[1880px]">
      <div className="absolute top-0 left-0 w-[613px] h-[1880px] bg-[#ffffff4c] rounded-[32.5px] border-[none] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:content-[''] before:absolute before:inset-0 before:p-px before:rounded-[32.5px] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:z-[1] before:pointer-events-none" />
      <div className="absolute top-[35px] left-[35px] w-[543px] h-20 bg-[#ffffff80] rounded-[32.5px] border border-solid border-white shadow-[inset_0px_0px_70.1px_#ffffffb2] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]" />
      <div className="absolute top-[63px] left-[60px] w-[493px] h-[25px] flex gap-[241px]">
        <div className="w-[136px] flex">
          <div className="w-[138px] flex gap-2.5">
            <div className="w-6 h-6 aspect-[1]">
              <div className="relative w-[58.33%] h-[45.83%] top-[27.08%] left-[22.92%] rotate-[-90.00deg]">
                <img className="absolute w-[96.43%] h-[59.09%] top-[40.91%] left-[3.57%] rotate-[90.00deg]" alt="Vector" src={vector5} />
                <img className="absolute w-[82.14%] h-[140.91%] top-[-40.91%] left-[17.86%] rotate-[90.00deg]" alt="Vector" src={vector6} />
              </div>
            </div>
            <div className="w-[102px] h-[25px] [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#2b3335] text-lg tracking-[0] leading-[normal]">На главную</div>
          </div>
        </div>
        <div className="w-[116px] flex">
          <div className="w-[118px] flex gap-2.5">
            <div className="w-6 h-6 flex items-center justify-center overflow-hidden aspect-[1]">
              <img className="h-5 w-5" alt="Vector" src={vector7} />
            </div>
            <div className="w-[82px] h-[25px] [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#2b3335] text-lg tracking-[0] leading-[normal]">Свернуть</div>
          </div>
        </div>
      </div>
      <div className="absolute top-[125px] left-[35px] w-[543px] h-[550px] flex flex-col gap-5 bg-[#ffffff80] rounded-[32.5px] border border-solid border-white shadow-[inset_0px_0px_70.1px_#ffffffb2] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
        <div className="flex ml-[25px] w-[397px] h-[70px] relative mt-[25px] flex-col items-start gap-2.5">
          <div className="relative self-stretch mt-[-1.00px] bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] [-webkit-background-clip:text] bg-clip-text [-webkit-text-fill-color:transparent] [text-fill-color:transparent] [font-family:'Soyuz_Grotesk-Bold',Helvetica] font-bold text-transparent text-[32px] tracking-[0] leading-[35.2px]">
            управление
          </div>
          <div className="relative self-stretch [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#5e6567] text-lg tracking-[0] leading-[normal]">Рабочая площадка — карта</div>
        </div>
        <div className="ml-[25px] w-[493px] flex flex-col items-start min-h-[410px] gap-[30px]">
          <div className="flex items-start min-w-[493px]">
            <div className="w-[493px] h-80 flex flex-col gap-[25px]">
              <div className="w-[497px] h-[90px] relative">
                <div className="absolute top-[30px] left-0 w-[493px] h-[60px] bg-[#ffffff73] rounded-[10px] border-[none] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:content-[''] before:absolute before:inset-0 before:p-px before:rounded-[10px] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:z-[1] before:pointer-events-none" />
                <div className="absolute top-12 left-[15px] [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#828583] text-lg tracking-[0] leading-[normal]">Выбрано: 1код ФККО</div>
                <div className="absolute top-0 left-0 [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#747b7d] text-lg tracking-[0] leading-[normal]">ФККО (необязательно)</div>
                <img className="absolute top-14 left-[460px] w-3 h-2.5" alt="Polygon" src={polygon2} />
              </div>
              <div className="w-[497px] h-[90px] relative">
                <div className="absolute top-[30px] left-0 w-[493px] h-[60px] bg-[#ffffff73] rounded-[10px] border-[none] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:content-[''] before:absolute before:inset-0 before:p-px before:rounded-[10px] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:z-[1] before:pointer-events-none" />
                <div className="absolute top-12 left-[15px] [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#828583] text-lg tracking-[0] leading-[normal]">Обезвреживание</div>
                <div className="absolute top-0 left-0 [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#747b7d] text-lg tracking-[0] leading-[normal]">Тип обращения</div>
                <img className="absolute top-14 left-[460px] w-3 h-2.5" alt="Polygon" src={image} />
              </div>
              <div className="w-[497px] h-[90px] relative">
                <div className="absolute top-[30px] left-0 w-[493px] h-[60px] bg-[#ffffff73] rounded-[10px] border-[none] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:content-[''] before:absolute before:inset-0 before:p-px before:rounded-[10px] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:z-[1] before:pointer-events-none" />
                <div className="absolute top-12 left-[15px] [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#828583] text-lg tracking-[0] leading-[normal]">Начните вводить регион</div>
                <div className="absolute top-0 left-0 [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#747b7d] text-lg tracking-[0] leading-[normal]">Регион (необязательно)</div>
                <img className="absolute top-14 left-[460px] w-3 h-2.5" alt="Polygon" src={polygon3} />
              </div>
            </div>
          </div>
          <div className="w-[493px] h-[60px] relative flex gap-5">
            <div className="w-[236px] h-[60px] relative flex rounded-[20px] border-[none] shadow-[0px_13px_31.5px_#c1df6466,inset_0px_0px_20px_#ffffffbd] bg-[linear-gradient(128deg,rgba(219,236,168,1)_0%,rgba(188,220,87,1)_100%)] before:content-[''] before:absolute before:inset-0 before:p-px before:rounded-[20px] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:z-[1] before:pointer-events-none">
              <div className="inline-flex mt-4 w-[98px] h-[27px] ml-[69px] relative items-start gap-2.5">
                <div className="relative w-fit mt-[-1.00px] [font-family:'Nunito-Bold',Helvetica] font-bold text-[#2b3335] text-xl text-center tracking-[0] leading-[normal]">Найти</div>
                <div className="relative w-[27px] h-[27px] aspect-[1]">
                  <img className="absolute top-[calc(50.00%_-_11px)] left-[calc(50.00%_-_11px)] w-5 h-5" alt="Vector" src={vector} />
                </div>
              </div>
            </div>
            <div className="mt-1 w-[237px] h-[52px] relative flex bg-[#ffffff73] rounded-[20px] border-[none] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:content-[''] before:absolute before:inset-0 before:p-px before:rounded-[20px] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:z-[1] before:pointer-events-none">
              <div className="mt-[15px] w-[177px] h-[22px] ml-[30px] inline-flex relative items-start gap-2.5">
                <div className="relative w-fit mt-[-1.00px] [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#2b3335] text-base text-center tracking-[0] leading-[normal]">Сбросить фильтры</div>
                <div className="relative w-[21px] h-[21px] aspect-[1]">
                  <img className="absolute top-[calc(50.00%_-_6px)] left-[calc(50.00%_-_6px)] w-2.5 h-3" alt="Vector" src={vector2} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-[685px] left-[35px] w-[543px] h-[145px] flex bg-[#ffffff80] rounded-[32.5px] border border-solid border-white shadow-[inset_0px_0px_70.1px_#ffffffb2] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
        <div className="flex mt-[25px] w-[314px] h-[95px] ml-[25px] relative flex-col items-start gap-2.5">
          <div className="relative self-stretch mt-[-1.00px] bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] [-webkit-background-clip:text] bg-clip-text [-webkit-text-fill-color:transparent] [text-fill-color:transparent] [font-family:'Soyuz_Grotesk-Bold',Helvetica] font-bold text-transparent text-[32px] tracking-[0] leading-[35.2px]">
            Результаты
          </div>
          <p className="relative self-stretch [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#5e6567] text-lg tracking-[0] leading-[normal]">
            Укажите вид обращения. Код ФККО и регион — по желанию.
          </p>
        </div>
      </div>
      <div className="absolute top-[840px] left-[35px] w-[545px] h-[200px]">
        <div className="top-0 left-0 h-[200px] absolute w-[543px] bg-[#ffffff80] rounded-[32.5px] border border-solid border-white shadow-[inset_0px_0px_70.1px_#ffffffb2] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]" />
        <div className="absolute top-[25px] left-[25px] bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] [-webkit-background-clip:text] bg-clip-text [-webkit-text-fill-color:transparent] [text-fill-color:transparent] [font-family:'Soyuz_Grotesk-Bold',Helvetica] font-bold text-transparent text-[32px] tracking-[0] leading-[35.2px] whitespace-nowrap">
          Легенда
        </div>
        <div className="absolute top-20 left-[25px] w-[233px] h-[95px] flex flex-col gap-2.5">
          <div className="inline-flex w-[110px] h-[25px] relative items-center gap-[15px]"><div className="bg-green-600 relative w-2.5 h-2.5 rounded-[5px]" /><div className="relative w-fit mt-[-1.00px] [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#5e6567] text-lg tracking-[0] leading-[normal]">Хранение</div></div>
          <div className="inline-flex w-[140px] h-[25px] relative items-center gap-[15px]"><div className="bg-yellow-500 relative w-2.5 h-2.5 rounded-[5px]" /><div className="relative w-fit mt-[-1.00px] [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#5e6567] text-lg tracking-[0] leading-[normal]">Захоронение</div></div>
          <div className="inline-flex w-[233px] h-[25px] relative items-center gap-[15px]"><div className="bg-green-500 relative w-2.5 h-2.5 rounded-[5px]" /><div className="relative w-fit mt-[-1.00px] [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#5e6567] text-lg tracking-[0] leading-[normal]">Утилизация / обработка</div></div>
        </div>
      </div>
      <div className="top-[1050px] left-[35px] h-[385px] absolute w-[543px] bg-[#ffffff80] rounded-[32.5px] border border-solid border-white shadow-[inset_0px_0px_70.1px_#ffffffb2] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]" />
      <div className="absolute top-[1075px] left-[60px] w-[314px] bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] [-webkit-background-clip:text] bg-clip-text [-webkit-text-fill-color:transparent] [text-fill-color:transparent] [font-family:'Soyuz_Grotesk-Bold',Helvetica] font-bold text-transparent text-[32px] tracking-[0] leading-[35.2px]">Подложка карты</div>
      <div className="absolute top-[1130px] left-[60px] w-[493px] h-[70px] bg-[#ffffff80] rounded-[23px] border border-solid border-white shadow-[inset_0px_0px_70.1px_#ffffffb2] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
        <div className="absolute top-[5px] left-[calc(50.00%_-_238px)] w-[237px] h-[60px]">
          <div className="absolute top-0 left-[calc(50.00%_-_118px)] w-[235px] h-[60px] rounded-[20px] border-[none] shadow-[0px_13px_31.5px_#c1df6466,inset_0px_0px_20px_#ffffffbd] bg-[linear-gradient(128deg,rgba(219,236,168,1)_0%,rgba(188,220,87,1)_100%)] before:content-[''] before:absolute before:inset-0 before:p-px before:rounded-[20px] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:z-[1] before:pointer-events-none" />
          <div className="absolute top-4 left-[calc(50.00%_-_46px)] [font-family:'Nunito-Bold',Helvetica] font-bold text-[#2b3335] text-xl text-center tracking-[0] leading-[normal]">Обычная</div>
        </div>
        <div className="absolute top-[5px] left-[calc(50.00%_+_6px)] w-[237px] h-[60px]">
          <div className="absolute top-0 left-[calc(50.00%_-_118px)] w-[235px] h-[60px] rounded-[20px]" />
          <div className="absolute top-4 left-[calc(50.00%_-_64px)] [font-family:'Nunito-Bold',Helvetica] font-bold text-[#2b3335] text-xl text-center tracking-[0] leading-[normal]">Кадастровая</div>
        </div>
      </div>
      <p className="absolute top-[1210px] left-[60px] w-[488px] [font-family:'Nunito-SemiBold',Helvetica] font-normal text-transparent text-lg tracking-[0] leading-[normal]">
        <span className="font-semibold text-[#5e6567]">
          Векторные границы участков (GeoJSON с бэкенда) и клик по карте — запрос сведений ПКК. При зуме ≥ 14 подгружаются контуры; клик открывает карточку. Если API ПКК редиректится, настройте CADASTRE_PKK_API_BASE / CADASTRE_MAPSERVER_BASE на сервере (см. server/.env.example). Альтернатива — iframe:{' '}
        </span>
        <span className="[font-family:'Nunito-Bold',Helvetica] font-bold text-[#2b3335]">VITE_CADASTRE_IFRAME_URL.</span>
      </p>
      <div className="absolute top-[1445px] left-[35px] w-[543px] h-[400px] bg-[#ffffff80] rounded-[32.5px] border border-solid border-white shadow-[inset_0px_0px_70.1px_#ffffffb2] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]" />
      <div className="absolute top-[1470px] left-[60px] w-[493px] bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] [-webkit-background-clip:text] bg-clip-text [-webkit-text-fill-color:transparent] [text-fill-color:transparent] [font-family:'Soyuz_Grotesk-Bold',Helvetica] font-bold text-transparent text-[32px] tracking-[0] leading-[35.2px]">Маршрут</div>
      <div className="absolute h-[205px] top-[1525px] left-[60px] flex items-start min-w-[493px]">
        <div className="w-[493px] h-[205px] flex flex-col gap-[25px]">
          <div className="w-[497px] h-[90px] relative">
            <div className="absolute top-[30px] left-0 w-[493px] h-[60px] bg-[#ffffff73] rounded-[10px] border-[none] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:content-[''] before:absolute before:inset-0 before:p-px before:rounded-[10px] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:z-[1] before:pointer-events-none" />
            <div className="absolute top-12 left-[15px] [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#828583] text-lg tracking-[0] leading-[normal]">Выберите объект</div>
            <div className="absolute top-0 left-0 [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#747b7d] text-lg tracking-[0] leading-[normal]">Точка А</div>
            <img className="absolute top-14 left-[460px] w-3.5 h-[13px]" alt="Polygon" src={polygon22} />
          </div>
          <div className="w-[497px] h-[90px] relative">
            <div className="absolute top-[30px] left-0 w-[493px] h-[60px] bg-[#ffffff73] rounded-[10px] border-[none] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:content-[''] before:absolute before:inset-0 before:p-px before:rounded-[10px] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:z-[1] before:pointer-events-none" />
            <div className="absolute top-12 left-[15px] [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#828583] text-lg tracking-[0] leading-[normal]">Выберите объект</div>
            <div className="absolute top-0 left-0 [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#747b7d] text-lg tracking-[0] leading-[normal]">Точка В</div>
            <img className="absolute top-14 left-[460px] w-3.5 h-[13px]" alt="Polygon" src={polygon23} />
          </div>
        </div>
      </div>
      <div className="absolute w-[493px] h-[60px] top-[1760px] left-[60px] flex gap-5">
        <div className="w-[236px] h-[60px] relative flex justify-center rounded-[20px] border-[none] shadow-[0px_13px_31.5px_#c1df6466,inset_0px_0px_20px_#ffffffbd] bg-[linear-gradient(128deg,rgba(219,236,168,1)_0%,rgba(188,220,87,1)_100%)] before:content-[''] before:absolute before:inset-0 before:p-px before:rounded-[20px] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:z-[1] before:pointer-events-none">
          <div className="mt-4 w-[140px] h-[27px] inline-flex relative items-start gap-2.5">
            <div className="relative w-fit mt-[-1.00px] [font-family:'Nunito-Bold',Helvetica] font-bold text-[#2b3335] text-xl text-center tracking-[0] leading-[normal]">Построить</div>
            <div className="relative w-[27px] h-[27px] overflow-hidden aspect-[1] flex items-center justify-center"><img className="w-[18px] h-[18px]" alt="Vector" src={vector3} /></div>
          </div>
        </div>
        <div className="mt-1 w-[237px] h-[52px] relative flex bg-[#ffffff73] rounded-[20px] border-[none] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:content-[''] before:absolute before:inset-0 before:p-px before:rounded-[20px] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:z-[1] before:pointer-events-none">
          <div className="mt-[15px] w-[104px] h-[22px] ml-[67px] inline-flex relative items-start gap-2.5">
            <div className="relative w-fit mt-[-1.00px] [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#2b3335] text-base text-center tracking-[0] leading-[normal]">Сбросить</div>
            <div className="relative w-[21px] h-[21px] overflow-hidden aspect-[1] flex items-center justify-center"><img className="w-2.5 h-3" alt="Vector" src={vector4} /></div>
          </div>
        </div>
      </div>
    </div>
  );
};
