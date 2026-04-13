import image3 from '@/assets/map-screen/image-3.svg';
import image4 from '@/assets/map-screen/image-4.svg';
import vector8 from '@/assets/map-screen/vector-8.svg';
import vector9 from '@/assets/map-screen/vector-9.svg';
import vector10 from '@/assets/map-screen/vector-10.svg';
import vector11 from '@/assets/map-screen/vector-11.svg';
import vector12 from '@/assets/map-screen/vector-12.svg';

const navItems = [
  {
    label: 'Разместить объект',
    labelWidth: 'w-[163px]',
    containerWidth: 'w-[197px]',
    innerWidth: 'w-[199px]',
    iconDefault: { src: image4, className: 'flex-1 w-[18px]' },
    iconHover: { src: image3, className: 'flex-1 w-4' },
    iconContainerHover: 'w-6 h-6 flex overflow-hidden aspect-[1]',
    iconContainerDefault: 'w-6 h-6 flex aspect-[1]',
  },
  {
    label: 'Открыть справочник',
    labelWidth: 'w-[181px]',
    containerWidth: 'w-[215px]',
    innerWidth: 'w-[217px]',
    iconDefault: { src: vector10, className: 'flex-1 w-[11.91px]' },
    iconHover: { src: vector9, className: 'flex-1 w-[15.84px]' },
    iconContainerHover: 'w-6 h-6 flex overflow-hidden aspect-[1]',
    iconContainerDefault: 'w-6 h-6 flex aspect-[1]',
  },
  {
    label: 'Личный кабинет',
    labelWidth: 'w-36',
    containerWidth: 'w-[178px]',
    innerWidth: 'w-[180px]',
    iconDefault: { src: vector12, className: 'flex-1 w-3.5' },
    iconHover: { src: vector11, className: 'flex-1 w-3.5' },
    iconContainerHover: 'w-6 h-6 flex overflow-hidden aspect-[1]',
    iconContainerDefault: 'w-6 h-6 flex aspect-[1]',
  },
];

export const GlobalNavigationBarSection = (): JSX.Element => {
  return (
    <div className="absolute top-5 left-[calc(50.00%_-_940px)] w-[1880px] h-[65px] bg-[#ffffff4c] rounded-[25px] border-[none] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:content-[''] before:absolute before:inset-0 before:p-px before:rounded-[25px] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:z-[1] before:pointer-events-none">
      <img className="absolute w-[98.94%] h-[83.08%] top-[16.92%] left-0" alt="Vector" src={vector8} />
      <div className="flex w-[35.64%] h-[38.46%] items-center gap-10 absolute top-[30.77%] left-[63.30%]">
        {navItems.map((item, index) => (
          <div key={index} className={`relative ${item.containerWidth} h-[25px] overflow-hidden`}>
            <div className={`absolute top-[30px] left-0 ${item.innerWidth} h-[25px] flex gap-2.5`}>
              <div
                className={`${item.labelWidth} h-[25px] [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#2b3335] text-lg text-center tracking-[0] leading-[normal]`}
              >
                {item.label}
              </div>
              <div className={item.iconContainerHover}>
                <img className={item.iconHover.className} alt={item.label} src={item.iconHover.src} />
              </div>
            </div>
            <div className={`absolute top-0 left-0 ${item.innerWidth} h-[25px] flex gap-2.5`}>
              <div
                className={`${item.labelWidth} h-[25px] [font-family:'Nunito-SemiBold',Helvetica] font-semibold text-[#2b3335] text-lg text-center tracking-[0] leading-[normal]`}
              >
                {item.label}
              </div>
              <div className={item.iconContainerDefault}>
                <img className={item.iconDefault.className} alt={item.label} src={item.iconDefault.src} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
