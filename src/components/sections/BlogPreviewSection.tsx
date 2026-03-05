import { BLOG_POSTS } from '@/constants/blog';
import { RevealOnScroll } from '@/components/ui/RevealOnScroll';

export function BlogPreviewSection(): JSX.Element {
  return (
    <section className="flex items-center justify-center pt-0 pb-[130px] px-0 relative self-stretch w-full flex-[0_0_auto] bg-[#f2f8f5]">
      <div className="flex flex-col max-w-[1510px] w-full items-center justify-center gap-[60px] px-[50px] py-0 relative">
        <RevealOnScroll variant="reveal" className="flex-col max-w-[770px] w-full items-center justify-center gap-5 flex-[0_0_auto] flex relative">
          <div className="flex self-stretch w-full flex-[0_0_auto] flex-col items-start relative">
            <h2 className="h-[168px] relative self-stretch w-full">
              <span className="absolute top-0 left-[calc(50.00%_-_372px)] w-[763px] h-[84px] flex items-center justify-center text-[#151e1b] text-center whitespace-nowrap [font-family:'Inter-Medium',Helvetica] font-medium text-[70px] tracking-[-0.70px] leading-[84px]">
                Eco-friendly designs &amp;
              </span>

              <span className="absolute top-[84px] left-[calc(50.00%_-_358px)] w-[717px] h-[84px] flex items-center justify-center [font-family:'Inter-Medium',Helvetica] font-medium text-[#151e1b] text-[70px] text-center tracking-[-0.70px] leading-[84px] whitespace-nowrap">
                recycling innovations.
              </span>
            </h2>
          </div>

          <div className="flex flex-col max-w-screen-sm w-[640px] items-start relative flex-[0_0_auto]">
            <p className="relative self-stretch w-full h-[66px]">
              <span className="absolute top-0 left-[calc(50.00%_-_315px)] w-[636px] h-[33px] flex items-center justify-center font-greenx-template-framer-website-inter-regular font-[number:var(--greenx-template-framer-website-inter-regular-font-weight)] text-[#6b7b76] text-[length:var(--greenx-template-framer-website-inter-regular-font-size)] text-center tracking-[var(--greenx-template-framer-website-inter-regular-letter-spacing)] leading-[var(--greenx-template-framer-website-inter-regular-line-height)] whitespace-nowrap [font-style:var(--greenx-template-framer-website-inter-regular-font-style)]">
                Our commitment to a greener future is reflected in every product
              </span>

              <span className="absolute top-8 left-[calc(50.00%_-_168px)] w-[336px] h-[33px] flex items-center justify-center font-greenx-template-framer-website-inter-regular font-[number:var(--greenx-template-framer-website-inter-regular-font-weight)] text-[#6b7b76] text-[length:var(--greenx-template-framer-website-inter-regular-font-size)] text-center tracking-[var(--greenx-template-framer-website-inter-regular-letter-spacing)] leading-[var(--greenx-template-framer-website-inter-regular-line-height)] whitespace-nowrap [font-style:var(--greenx-template-framer-website-inter-regular-font-style)]">
                we create and service we provide.
              </span>
            </p>
          </div>
        </RevealOnScroll>

        <div className="flex items-center justify-center gap-5 relative self-stretch w-full flex-[0_0_auto]">
          {BLOG_POSTS.map((post, index) => (
            <RevealOnScroll key={post.id} variant="reveal-scale" delay={`${0.1 + index * 0.12}s`} className="flex flex-col items-start justify-center relative">
            <article
              className="flex flex-col items-start justify-center relative"
              style={{ width: post.width }}
            >
              <a
                className="flex min-h-80 items-start relative self-stretch w-full flex-[0_0_auto] rounded-[20px] overflow-hidden"
                href={post.url}
                rel="noopener noreferrer"
                target="_blank"
                aria-label={post.title}
              >
                <div
                  className="absolute w-full h-full top-0 left-0 rounded-[20px] bg-cover bg-[50%_50%]"
                  style={{ backgroundImage: `url(${post.image})` }}
                  role="img"
                  aria-label={post.title}
                />

                <div
                  className="relative self-stretch bg-[#3333334c]"
                  style={{ width: post.width }}
                />

                <div className="flex flex-col max-w-[390px] w-[390px] items-center justify-center gap-[10.01px] absolute left-[30px] bottom-[-95px]">
                  <div className="flex self-stretch w-full flex-[0_0_auto] flex-col items-start relative">
                    <div className="flex flex-col items-start pt-0 pb-[0.69px] px-0 relative self-stretch w-full flex-[0_0_auto]">
                      <h3 className="self-stretch [font-family:'Inter-Medium',Helvetica] font-medium text-[34px] tracking-[-1.02px] leading-[40.8px] relative mt-[-1.00px] text-white">
                        {index === 0 ? (
                          <>
                            Our people is the heart of <br />
                            our mission.
                          </>
                        ) : (
                          <>
                            Solutions to promote <br />
                            sustainability.
                          </>
                        )}
                      </h3>
                    </div>
                  </div>

                  <div className="min-h-[100px] pt-0 pb-[46px] px-0 self-stretch w-full flex flex-col items-start relative flex-[0_0_auto]">
                    <div className="flex flex-col items-start pt-0 pb-[27px] px-0 flex-[0_0_auto] relative self-stretch w-full">
                      <p className="flex items-center self-stretch [font-family:'Inter-Regular',Helvetica] font-normal text-lg tracking-[-0.36px] leading-[27px] relative mt-[-1.00px] text-white">
                        {post.description}
                      </p>
                    </div>
                  </div>
                </div>
              </a>
            </article>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
