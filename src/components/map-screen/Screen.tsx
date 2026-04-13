import { FilterManagementSidebarSection } from './FilterManagementSidebarSection';
import { GlobalNavigationBarSection } from './GlobalNavigationBarSection';
import group264 from '@/assets/map-screen/group-264.svg';
import image2 from '@/assets/map-screen/image-2.svg';

export const Screen = (): JSX.Element => {
  return (
    <div className="bg-[#f9fbfe] overflow-hidden w-full min-w-[1920px] min-h-[1080px] relative">
      <div className="flex flex-col w-[7px] items-start gap-[3px] absolute top-[514px] left-[1854px]">
        <div className="relative self-stretch w-full h-0.5 bg-[#bec6c1] rounded-[32.5px]" />
        <div className="relative self-stretch w-full h-0.5 bg-[#bec6c1] rounded-[32.5px]" />
        <div className="relative self-stretch w-full h-0.5 bg-[#bec6c1] rounded-[32.5px]" />
        <div className="relative self-stretch w-full h-0.5 bg-[#bec6c1] rounded-[32.5px]" />
        <div className="relative self-stretch w-full h-0.5 bg-[#bec6c1] rounded-[32.5px]" />
      </div>
      <GlobalNavigationBarSection />
      <FilterManagementSidebarSection />
      <img className="absolute top-[95px] left-[638px] w-[15px] h-[975px]" alt="Group" src={group264} />
      <img className="absolute top-[calc(50.00%_-_39px)] left-[calc(50.00%_+_31px)] w-[612px] h-[153px]" alt="Image" src={image2} />
    </div>
  );
};
