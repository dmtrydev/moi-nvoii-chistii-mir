import { SiteFrameWithTopNav } from '@/components/home-landing/SiteFrameWithTopNav';
import { SitePublicPageShell } from '@/components/home-landing/SitePublicPageShell';

export default function CookiePolicyPage(): JSX.Element {
  return (
    <SitePublicPageShell>
      <SiteFrameWithTopNav>
        <section className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <article className="rounded-[32px] border border-white bg-[#ffffffb3] p-6 shadow-[inset_0px_0px_70px_#ffffffb2] backdrop-blur-[10px] sm:p-8 lg:p-10">
            <h1 className="typo-h3 mb-3 bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-fill-color:transparent]">
              Cookie Policy
            </h1>
            <p className="mb-6 font-nunito text-sm font-semibold text-[#5e6567] sm:text-base">
              Платформа: https://app.moinovichistimir.ru/
            </p>

            <div className="space-y-4 font-nunito text-sm leading-relaxed text-[#2b3335] sm:text-base">
              <p>
                Эта страница описывает, какие cookie-файлы используются на платформе, для каких
                целей и как пользователь может изменить свой выбор.
              </p>

              <div>
                <p className="font-bold">1. Обязательные cookies (Necessary)</p>
                <p className="mt-1">
                  Необходимы для работы платформы и безопасности. Без них невозможно корректно
                  выполнить вход, поддерживать пользовательскую сессию и защиту запросов.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>`refresh_token`, `access_token` — авторизация пользователя.</li>
                  <li>`csrf_token` — защита от CSRF-атак.</li>
                  <li>Технические служебные cookie для стабильной работы интерфейса.</li>
                </ul>
              </div>

              <div>
                <p className="font-bold">2. Аналитические cookies (Analytics)</p>
                <p className="mt-1">
                  Используются только после явного согласия пользователя и помогают оценивать
                  работу платформы.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Сервис: Яндекс.Метрика (`mc.yandex.ru`).</li>
                  <li>Цели: статистика посещаемости, поведенческий анализ, улучшение сервиса.</li>
                  <li>Данные: события и обезличенные технические параметры посещений.</li>
                </ul>
              </div>

              <div>
                <p className="font-bold">3. Как изменить настройки</p>
                <p className="mt-1">
                  На каждой странице доступна кнопка «Настройки cookies». Через нее можно в любой
                  момент изменить выбор для аналитических cookie.
                </p>
              </div>

              <div>
                <p className="font-bold">4. Как отключить cookies в браузере</p>
                <p className="mt-1">
                  Вы можете ограничить или полностью отключить cookies в настройках браузера. Это
                  может повлиять на работоспособность некоторых функций платформы.
                </p>
              </div>

              <div>
                <p className="font-bold">5. Контакты по вопросам персональных данных</p>
                <p className="mt-1">
                  ООО «МОЙ НОВЫЙ ЧИСТЫЙ МИР», email: <span className="font-semibold">info@levchukov.ru</span>.
                </p>
              </div>
            </div>
          </article>
        </section>
      </SiteFrameWithTopNav>
    </SitePublicPageShell>
  );
}
